import { Duration, Effect, Queue, Ref, Stream } from "effect"
import { readManifest } from "../rules/manifest.ts"
import { NO_PERMISSIONS, type Permissions } from "../rules/permissions.ts"
import { BuiltinPlugins, type BuiltinPlugin } from "./builtin-plugins.ts"
import { PluginHost, type RunningPluginHost } from "./plugin-host.ts"
import { PluginReloads, builtinKey, builtinKeyId, type ReloadRequest } from "./plugin-reloads.ts"
import { disabledPlugins } from "./plugin-switches.ts"
import { pluginFolders } from "./project-plugins.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"
import { serveHost } from "./serve-host.ts"
import { ServerHalves } from "./server-halves.ts"
import { UserPlugins, type PluginFolder } from "./user-plugins.ts"

export interface PluginHostTimings {
  readonly heartbeatEvery: Duration.Input
  readonly heartbeatTimeout: Duration.Input
  readonly restartDelay: Duration.Input
  // Activations after which an idle host is replaced: each one leaves an old module in its memory.
  readonly maxActivations: number
}

export const defaultPluginHostTimings: PluginHostTimings = {
  heartbeatEvery: Duration.seconds(1),
  heartbeatTimeout: Duration.seconds(5),
  restartDelay: Duration.seconds(1),
  maxActivations: 50,
}

interface ServerHalf {
  readonly id: string
  readonly file: string
}

type Ending =
  | { readonly kind: "blocked" }
  | { readonly kind: "exited"; readonly reason: string }
  | { readonly kind: "recycled" }

const seconds = (input: Duration.Input) => Duration.toSeconds(Duration.fromInputUnsafe(input))

type Compiled =
  | { readonly kind: "none" }
  | {
      readonly kind: "compiled"
      readonly id: string
      readonly file: string
      readonly permissions: Permissions
    }
  | { readonly kind: "failed"; readonly id: string; readonly reason: string }

const compileHalf = (
  folder: PluginFolder,
  disabled: ReadonlySet<string>,
): Effect.Effect<Compiled> =>
  Effect.gen(function* () {
    const plugins = yield* UserPlugins
    if (plugins === null) return { kind: "none" } as const
    const reading = readManifest(folder.manifest)
    if (reading.kind === "invalid" || reading.manifest.server === null) {
      return { kind: "none" } as const
    }
    const { id, server, permissions } = reading.manifest
    if (disabled.has(id)) return { kind: "none" } as const
    return yield* plugins.compile({ id, path: folder.path, entry: server, half: "server" }).pipe(
      Effect.map((file): Compiled => ({
        kind: "compiled",
        id,
        file: plugins.bundlePath(file),
        permissions,
      })),
      Effect.catchTag("PluginNotCompiled", ({ reason }) =>
        Effect.succeed<Compiled>({ kind: "failed", id, reason }),
      ),
    )
  })

const heartbeat = (host: RunningPluginHost, timings: PluginHostTimings) =>
  Effect.gen(function* () {
    while (true) {
      yield* Effect.sleep(timings.heartbeatEvery)
      const answered = yield* host.ping.pipe(Effect.timeoutOption(timings.heartbeatTimeout))
      if (answered._tag === "None") return { kind: "blocked" } as const satisfies Ending
    }
  })

interface Registry {
  // In load order: the built-in plugins first.
  readonly files: Map<string, string>
  readonly permissions: Map<string, Permissions>
  readonly idOfFolder: Map<string, string>
  readonly disabled: Set<string>
}

interface Change {
  // The plugin whose running half goes, with no replacement under that id.
  readonly drop: string | null
  readonly start: ServerHalf | null
}

const builtinHalf = (
  builtin: BuiltinPlugin | undefined,
  bundlePath: (name: string) => string,
  disabled: ReadonlySet<string>,
  registry: Registry,
  key: string,
): Compiled => {
  if (builtin?.server == null) return { kind: "none" }
  const reading = readManifest(builtin.manifest)
  if (reading.kind === "invalid" || disabled.has(reading.manifest.id)) return { kind: "none" }
  const { id, permissions } = reading.manifest
  // A plugin with this id from a folder replaces the built-in one.
  const heldByFolder = [...registry.idOfFolder].some(([name, held]) => held === id && name !== key)
  return heldByFolder
    ? { kind: "none" }
    : { kind: "compiled", id, file: bundlePath(builtin.server), permissions }
}

const resolve = (registry: Registry, { folder: folderName, force }: ReloadRequest) =>
  Effect.gen(function* () {
    const disabled = yield* disabledPlugins
    const folder = (yield* pluginFolders).find((f) => f.name === folderName)
    const known = registry.idOfFolder.get(folderName) ?? null
    const builtinId = builtinKeyId(folderName)
    const builtins = yield* BuiltinPlugins
    const compiled: Compiled =
      folder !== undefined
        ? yield* compileHalf(folder, disabled)
        : builtinId !== null && builtins !== null
          ? builtinHalf(
              builtins.plugins.find((plugin) => {
                const reading = readManifest(plugin.manifest)
                return reading.kind === "valid" && reading.manifest.id === builtinId
              }),
              builtins.bundlePath,
              disabled,
              registry,
              folderName,
            )
          : { kind: "none" }
    if (compiled.kind === "failed") {
      // The version that runs keeps running.
      yield* reportPluginFailure(compiled.id, compiled.reason)
      return { drop: null, start: null } satisfies Change
    }
    if (compiled.kind === "none") {
      if (known === null) return { drop: null, start: null } satisfies Change
      registry.files.delete(known)
      registry.idOfFolder.delete(folderName)
      return { drop: known, start: null } satisfies Change
    }
    // A change that left the compiled file as it was (a save that wrote the same text) swaps nothing.
    if (!force && registry.files.get(compiled.id) === compiled.file) {
      return { drop: null, start: null } satisfies Change
    }
    registry.idOfFolder.set(folderName, compiled.id)
    registry.files.set(compiled.id, compiled.file)
    registry.permissions.set(compiled.id, compiled.permissions)
    registry.disabled.delete(compiled.id)
    return {
      drop: known !== null && known !== compiled.id ? known : null,
      start: { id: compiled.id, file: compiled.file },
    } satisfies Change
  })

const runOnce = (
  registry: Registry,
  pending: Queue.Queue<ReloadRequest>,
  timings: PluginHostTimings,
  activating: Ref.Ref<string | null>,
) =>
  Effect.gen(function* () {
    const states = yield* ServerHalves
    const reloads = yield* PluginReloads
    const launcher = yield* PluginHost
    if (launcher === null) return yield* Effect.never
    const host = yield* launcher.launch
    yield* Effect.forkScoped(
      host.logs.pipe(Stream.runForEach(({ id, line }) => reportPluginFailure(id, line))),
    )
    const served = yield* serveHost(host, {
      order: () => [...registry.files.keys()],
      permissions: (id) => registry.permissions.get(id) ?? NO_PERMISSIONS,
    })
    let activations = 0
    const activate = (half: ServerHalf) =>
      Effect.gen(function* () {
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
      })
    const activation = Effect.gen(function* () {
      // A half that failed to activate stays failed until its files change or the server restarts.
      for (const [id, file] of registry.files) {
        if (registry.disabled.has(id) || (yield* states.get(id)) === "failed") continue
        yield* activate({ id, file })
      }
      while (true) {
        const request = yield* Queue.take(pending)
        const change = yield* resolve(registry, request)
        if (change.drop !== null) {
          yield* host.deactivate(change.drop)
          yield* served.forget(change.drop)
          yield* states.set(change.drop, "none")
        }
        if (change.start !== null) {
          activations++
          yield* host.deactivate(change.start.id)
          yield* served.forget(change.start.id)
          yield* activate(change.start)
        }
        yield* reloads.complete(request.folder)
        if (activations >= timings.maxActivations && (yield* Queue.size(pending)) === 0) {
          return { kind: "recycled" } as const satisfies Ending
        }
      }
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
    const plugins = yield* UserPlugins
    const builtins = yield* BuiltinPlugins
    if (plugins === null && builtins === null) return
    const states = yield* ServerHalves
    const reloads = yield* PluginReloads
    const registry: Registry = {
      files: new Map(),
      permissions: new Map(),
      idOfFolder: new Map(),
      disabled: new Set(),
    }
    // Held across host launches, so a request made while the host restarts is served by the next one.
    const pending = yield* Queue.unbounded<ReloadRequest>()
    const requests = yield* reloads.subscribe
    yield* Effect.forkScoped(
      requests.pipe(Stream.runForEach((request) => Queue.offer(pending, request))),
    )
    const disabled = yield* disabledPlugins
    const userFolders = plugins === null ? [] : yield* pluginFolders
    const userIds = new Set(
      userFolders.flatMap((folder) => {
        const reading = readManifest(folder.manifest)
        return reading.kind === "valid" ? [reading.manifest.id] : []
      }),
    )
    // Loaded first, and replaced as a whole by a user plugin with the same id.
    for (const builtin of builtins?.plugins ?? []) {
      const reading = readManifest(builtin.manifest)
      if (reading.kind === "invalid" || builtin.server === null) continue
      if (userIds.has(reading.manifest.id) || disabled.has(reading.manifest.id)) continue
      registry.files.set(reading.manifest.id, builtins!.bundlePath(builtin.server))
      registry.permissions.set(reading.manifest.id, reading.manifest.permissions)
      registry.idOfFolder.set(builtinKey(reading.manifest.id), reading.manifest.id)
    }
    const seen = new Set<string>()
    for (const folder of userFolders) {
      const reading = readManifest(folder.manifest)
      // plugin.list reports a duplicate id for the UI half.
      if (reading.kind === "valid") {
        if (seen.has(reading.manifest.id)) continue
        seen.add(reading.manifest.id)
      }
      const compiled = yield* compileHalf(folder, disabled)
      if (compiled.kind === "compiled") {
        registry.files.set(compiled.id, compiled.file)
        registry.permissions.set(compiled.id, compiled.permissions)
        registry.idOfFolder.set(folder.name, compiled.id)
      } else if (compiled.kind === "failed") {
        registry.idOfFolder.set(folder.name, compiled.id)
        yield* states.set(compiled.id, "failed")
        yield* reportPluginFailure(compiled.id, compiled.reason)
      }
    }
    const activating = yield* Ref.make<string | null>(null)
    while (true) {
      const runnable = [...registry.files.keys()].filter((id) => !registry.disabled.has(id))
      if (runnable.length === 0) {
        // No process for nothing to run: wait for a plugin that has a server half.
        const request = yield* Queue.take(pending)
        yield* resolve(registry, request)
        yield* reloads.complete(request.folder)
        continue
      }
      const ending = yield* Effect.scoped(runOnce(registry, pending, timings, activating)).pipe(
        Effect.catchTag("PluginHostNotStarted", ({ reason }) =>
          Effect.logError(`the plugin host did not start: ${reason}`).pipe(
            Effect.as({ kind: "exited", reason } satisfies Ending),
          ),
        ),
      )
      if (ending.kind === "recycled") continue
      const culprit = yield* Ref.getAndSet(activating, null)
      const cause =
        ending.kind === "blocked"
          ? `its server half blocked the plugin host: no answer to the heartbeat for ${seconds(timings.heartbeatTimeout)} s`
          : `its server half made the plugin host stop (${ending.reason})`
      if (culprit === null) {
        yield* Effect.logWarning(`the plugin host stopped with no plugin to blame: ${cause}`)
      } else {
        registry.disabled.add(culprit)
        yield* states.set(culprit, "disabled")
        yield* reportPluginFailure(
          culprit,
          `Disabled for ${ending.kind === "blocked" ? "blocking" : "stopping"} the plugin host: ${cause}.`,
        )
      }
      yield* Effect.sleep(timings.restartDelay)
    }
  })
