import { Duration, Effect, Ref, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { PluginHost, type RunningPluginHost } from "./plugin-host.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { ServerHalves } from "./server-halves.ts"
import { UserPlugins } from "./user-plugins.ts"

export interface PluginHostTimings {
  readonly heartbeatEvery: Duration.Input
  readonly heartbeatTimeout: Duration.Input
  readonly restartDelay: Duration.Input
}

export const defaultPluginHostTimings: PluginHostTimings = {
  heartbeatEvery: Duration.seconds(1),
  heartbeatTimeout: Duration.seconds(5),
  restartDelay: Duration.seconds(1),
}

interface ServerHalf {
  readonly id: string
  readonly file: string
}

type Ending = { readonly kind: "blocked" } | { readonly kind: "exited"; readonly reason: string }

const seconds = (input: Duration.Input) => Duration.toSeconds(Duration.fromInputUnsafe(input))

// Compiles each valid server half once; the others are marked failed and logged once.
const compileHalves = Effect.gen(function* () {
  const plugins = yield* UserPlugins
  const halves = yield* ServerHalves
  if (plugins === null) return []
  const compiled: ServerHalf[] = []
  const seen = new Set<string>()
  for (const folder of yield* plugins.folders) {
    const reading = readManifest(folder.manifest)
    if (reading.kind === "invalid" || reading.manifest.server === null) continue
    const { id, server } = reading.manifest
    // plugin.list reports a duplicate id for the UI half.
    if (seen.has(id)) continue
    seen.add(id)
    const file = yield* plugins
      .compile({ id, path: folder.path, entry: server, half: "server" })
      .pipe(
        Effect.catchTag("PluginNotCompiled", ({ reason }) =>
          halves
            .set(id, "failed")
            .pipe(Effect.andThen(reportPluginFailure(id, reason)), Effect.as(null)),
        ),
      )
    if (file !== null) compiled.push({ id, file: plugins.bundlePath(file) })
  }
  return compiled
})

const heartbeat = (host: RunningPluginHost, timings: PluginHostTimings) =>
  Effect.gen(function* () {
    while (true) {
      yield* Effect.sleep(timings.heartbeatEvery)
      const answered = yield* host.ping.pipe(Effect.timeoutOption(timings.heartbeatTimeout))
      if (answered._tag === "None") return { kind: "blocked" } as const satisfies Ending
    }
  })

// One host process: activates the halves in order and ends when it blocks or exits.
const runOnce = (
  halves: ReadonlyArray<ServerHalf>,
  timings: PluginHostTimings,
  activating: Ref.Ref<string | null>,
) =>
  Effect.gen(function* () {
    const states = yield* ServerHalves
    const launcher = yield* PluginHost
    if (launcher === null) return yield* Effect.never
    const host = yield* launcher.launch
    yield* Effect.forkScoped(
      host.logs.pipe(Stream.runForEach(({ id, line }) => reportPluginFailure(id, line))),
    )
    const activation = Effect.gen(function* () {
      for (const half of halves) {
        yield* Ref.set(activating, half.id)
        const failure = yield* host.activate(half).pipe(
          Effect.as(null),
          Effect.catchTag("PluginActivateFailed", ({ reason }) => Effect.succeed(reason)),
        )
        yield* Ref.set(activating, null)
        if (failure === null) yield* states.set(half.id, "active")
        else {
          yield* states.set(half.id, "failed")
          yield* reportPluginFailure(half.id, `Its server half failed to activate: ${failure}`)
        }
      }
      return yield* Effect.never
    })
    return yield* Effect.raceFirst(
      Effect.raceFirst(
        activation,
        host.exited.pipe(Effect.map((reason): Ending => ({ kind: "exited", reason }))),
      ),
      heartbeat(host, timings),
    )
  })

export const runPluginHost = (timings: PluginHostTimings = defaultPluginHostTimings) =>
  Effect.gen(function* () {
    if ((yield* PluginHost) === null) return
    const states = yield* ServerHalves
    const halves = yield* compileHalves
    const disabled = new Set<string>()
    const activating = yield* Ref.make<string | null>(null)
    while (true) {
      const ending = yield* Effect.scoped(
        runOnce(
          halves.filter((half) => !disabled.has(half.id)),
          timings,
          activating,
        ),
      ).pipe(
        Effect.catchTag("PluginHostNotStarted", ({ reason }) =>
          Effect.logError(`the plugin host did not start: ${reason}`).pipe(
            Effect.as({ kind: "exited", reason } as Ending),
          ),
        ),
      )
      const culprit = yield* Ref.getAndSet(activating, null)
      const cause =
        ending.kind === "blocked"
          ? `its server half blocked the plugin host: no answer to the heartbeat for ${seconds(timings.heartbeatTimeout)} s`
          : `its server half made the plugin host stop (${ending.reason})`
      if (culprit === null) {
        yield* Effect.logWarning(`the plugin host stopped with no plugin to blame: ${cause}`)
      } else {
        disabled.add(culprit)
        yield* states.set(culprit, "disabled")
        yield* reportPluginFailure(
          culprit,
          `Disabled for ${ending.kind === "blocked" ? "blocking" : "stopping"} the plugin host: ${cause}.`,
        )
      }
      yield* Effect.sleep(timings.restartDelay)
    }
  })
