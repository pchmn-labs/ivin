import { AnnotationTarget } from "@ivin/contracts/annotation"
import { CommandFailed, CommandNotFound, type HostCall } from "@ivin/contracts/plugin"
import { Cause, Duration, Effect, Option, Queue, Schema, Stream } from "effect"
import { apiValues } from "../rules/api-values.ts"
import { settingChanges } from "../rules/plugin-setting-changes.ts"
import { PluginFetchRequest } from "@ivin/contracts/plugin-fetch"
import type { Permissions, PluginCall } from "../rules/permissions.ts"
import { checkPluginCall } from "./check-plugin-call.ts"
import { fetchForPlugin } from "./fetch-for-plugin.ts"
import { type SpawnOutcome, PluginBridge, type WatchedKind } from "./plugin-bridge.ts"
import type { RunningPluginHost } from "./plugin-host.ts"
import { PluginCallFailed, PluginServices } from "./plugin-services.ts"
import { PluginStorage } from "./plugin-storage.ts"
import { makePollScheduler } from "./poll-scheduler.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"

const BEFORE_SPAWN_LIMIT = Duration.seconds(2)

type Json = Schema.Json
type Args = { readonly [key: string]: Json }

const argsOf = (value: Json): Args =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Args) : {}

const fail = (reason: string) => new PluginCallFailed({ reason })

const stringArg = (args: Args, name: string): Effect.Effect<string, PluginCallFailed> => {
  const value = args[name]
  return typeof value === "string"
    ? Effect.succeed(value)
    : Effect.fail(fail(`${name} must be a string`))
}

const targetArg = (args: Args): Effect.Effect<AnnotationTarget, PluginCallFailed> =>
  Option.match(Schema.decodeUnknownOption(AnnotationTarget)(args["target"]), {
    onNone: () => Effect.fail(fail("target is not an annotation target")),
    onSome: Effect.succeed,
  })

// Answers the plugins' `ctx` calls and tells them what happens, for as long as `host` runs.
export const serveHost = (
  host: RunningPluginHost,
  plugins: {
    // The ids of the running plugins, in load order.
    readonly order: () => ReadonlyArray<string>
    readonly permissions: (id: string) => Permissions
  },
) =>
  Effect.gen(function* () {
    const bridge = yield* PluginBridge
    const services = yield* PluginServices
    const storage = yield* PluginStorage
    const subscribers = new Map<WatchedKind | "settingChanged" | "beforeSpawn", Set<string>>()
    const commands = new Map<string, string>()

    const dispatch = (
      id: string,
      kind: Parameters<typeof host.dispatch>[0]["kind"],
      payload: Json,
    ) => host.dispatch({ id, kind, payload })

    const subscribe = (id: string, kind: WatchedKind | "settingChanged" | "beforeSpawn") => {
      const set = subscribers.get(kind) ?? new Set<string>()
      subscribers.set(kind, set.add(id))
      if (kind === "transcript" || kind === "sessionCreated" || kind === "sessionChanged")
        bridge.watch(kind, true)
    }
    const subscribersOf = (kind: WatchedKind | "settingChanged" | "beforeSpawn") =>
      plugins.order().filter((id) => subscribers.get(kind)?.has(id))

    const scheduler = yield* makePollScheduler(bridge.windowVisible, (plugin, key) =>
      dispatch(plugin, "poll", { key }).pipe(
        Effect.map((result) => {
          const every = argsOf(result)["every"]
          return typeof every === "number" ? every : null
        }),
        Effect.catchTag("PluginHandlerFailed", ({ reason }) =>
          reportPluginFailure(plugin, `A poll of ${key} failed: ${reason}`).pipe(Effect.as(null)),
        ),
      ),
    )

    const runCommand = (command: string, args: Json) =>
      Effect.gen(function* () {
        const owner = commands.get(command)
        if (owner === undefined) return yield* new CommandNotFound({ command })
        return yield* dispatch(owner, "command", { command, args }).pipe(
          Effect.catchTag("PluginHandlerFailed", ({ reason }) =>
            Effect.fail(new CommandFailed({ command, reason })),
          ),
        )
      })

    const beforeSpawn = (sessionId: string) =>
      Effect.gen(function* () {
        let env: Record<string, string> = {}
        const warnings: string[] = []
        for (const id of subscribersOf("beforeSpawn")) {
          const answer = yield* dispatch(id, "beforeSpawn", { sessionId }).pipe(
            Effect.timeoutOption(BEFORE_SPAWN_LIMIT),
            Effect.map(
              Option.match({
                onNone: () => ({
                  warning: `${id}: its beforeSpawn hook took over 2 s and was skipped.`,
                }),
                onSome: (patch) => ({ patch }),
              }),
            ),
            Effect.catchTag("PluginHandlerFailed", ({ reason }) =>
              Effect.succeed({
                warning: `${id}: its beforeSpawn hook failed and was skipped: ${reason}`,
              }),
            ),
          )
          if ("warning" in answer) {
            warnings.push(answer.warning)
            yield* reportPluginFailure(id, answer.warning)
            continue
          }
          const added = argsOf(argsOf(answer.patch)["env"] ?? null)
          env = {
            ...env,
            ...Object.fromEntries(
              Object.entries(added).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            ),
          }
        }
        return { env, warnings } satisfies SpawnOutcome
      })

    bridge.connect({ beforeSpawn, runCommand })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        bridge.connect(null)
        bridge.watch("transcript", false)
        bridge.watch("sessionCreated", false)
        bridge.watch("sessionChanged", false)
      }),
    )

    const handle = (
      call: HostCall,
    ): Effect.Effect<Json, PluginCallFailed | CommandNotFound | CommandFailed> => {
      const { id, method } = call
      const args = argsOf(call.args)
      switch (method) {
        case "transcript.subscribe":
        case "sessions.subscribe":
        case "sessions.subscribeChanged":
        case "settings.subscribe":
        case "beforeSpawn.subscribe": {
          const kind = {
            "transcript.subscribe": "transcript",
            "sessions.subscribe": "sessionCreated",
            "sessions.subscribeChanged": "sessionChanged",
            "settings.subscribe": "settingChanged",
            "beforeSpawn.subscribe": "beforeSpawn",
          }[method] as WatchedKind | "settingChanged" | "beforeSpawn"
          return Effect.sync(() => {
            subscribe(id, kind)
            return null
          })
        }
        case "annotations.add":
          return Effect.gen(function* () {
            const target = yield* targetArg(args)
            const kind = yield* stringArg(args, "kind")
            return (yield* services.addAnnotation(id, target, kind, args["data"] ?? null)) as Json
          })
        case "annotations.remove":
          return stringArg(args, "id").pipe(
            Effect.flatMap((annotation) => services.removeAnnotation(id, annotation)),
            Effect.as(null),
          )
        case "annotations.list":
          return Effect.gen(function* () {
            const target = yield* targetArg(args)
            const kind = typeof args["kind"] === "string" ? args["kind"] : null
            return (yield* services.listAnnotations(id, target, kind)) as Json
          })
        case "annotations.listAll":
          return Effect.gen(function* () {
            const target = yield* targetArg(args)
            const kind = typeof args["kind"] === "string" ? args["kind"] : null
            return (yield* services.listAllAnnotations(target, kind)) as Json
          })
        case "sessions.list":
          return services.listSessions.pipe(Effect.map((all) => all as Json))
        case "sessions.get":
          return stringArg(args, "sessionId").pipe(
            Effect.flatMap((sessionId) => services.getSession(sessionId)),
            Effect.map((session) =>
              session === null ? { missing: true } : { value: session as Json },
            ),
          )
        case "storage.get":
          return stringArg(args, "key").pipe(
            Effect.flatMap((key) => storage.get(id, key)),
            // Undefined has no JSON form: the host reads it back as missing.
            Effect.map((value) => (value === undefined ? { missing: true } : { value })),
          )
        case "storage.set":
          return stringArg(args, "key").pipe(
            Effect.flatMap((key) => storage.set(id, key, args["value"] ?? null)),
            Effect.as(null),
          )
        case "settings.get":
          return stringArg(args, "key").pipe(
            Effect.flatMap((key) =>
              services.pluginSettings.pipe(
                Effect.map((all) => all.find((s) => s.pluginId === id && s.key === key)),
                Effect.map((setting) =>
                  setting === undefined ? { missing: true } : { value: setting.value },
                ),
              ),
            ),
          )
        case "commands.register":
          return stringArg(args, "command").pipe(
            Effect.map((command) => {
              commands.set(command, id)
              return null
            }),
          )
        case "commands.run":
          return stringArg(args, "command").pipe(
            Effect.flatMap((command) => runCommand(command, args["args"] ?? null)),
          )
        case "poll.register": {
          const every = args["every"]
          return stringArg(args, "key").pipe(
            Effect.flatMap((key) =>
              typeof every === "number" && every > 0
                ? scheduler.register(id, key, every)
                : Effect.fail(fail("every must be a positive number of milliseconds")),
            ),
            Effect.as(null),
          )
        }
        case "poll.unregister":
          return stringArg(args, "key").pipe(
            Effect.flatMap((key) => scheduler.stop(id, key)),
            Effect.as(null),
          )
        case "permission.check":
          return checkPluginCall(
            id,
            plugins.permissions(id),
            args["call"] as unknown as PluginCall,
          ).pipe(Effect.as(null))
        case "fetch":
          return Option.match(Schema.decodeUnknownOption(PluginFetchRequest)(args["request"]), {
            onNone: () => Effect.fail(fail("request is not a fetch request")),
            onSome: (request) =>
              fetchForPlugin(id, plugins.permissions(id), request) as Effect.Effect<
                Json,
                PluginCallFailed
              >,
          })
        default:
          return Effect.fail(fail(`ctx has no call named ${method}`))
      }
    }

    yield* host.calls.pipe(
      Stream.runForEach((call) =>
        handle(call).pipe(
          Effect.matchEffect({
            onSuccess: (value) => host.reply({ callId: call.callId, failure: null, value }),
            onFailure: (error) =>
              host.reply({
                callId: call.callId,
                failure:
                  "reason" in error
                    ? error.reason
                    : error._tag === "CommandNotFound"
                      ? `No command named ${error.command}.`
                      : String(error),
                value: null,
              }),
          }),
          Effect.forkScoped,
        ),
      ),
      Effect.forkScoped,
    )

    yield* Queue.take(bridge.events).pipe(
      Effect.flatMap((event) =>
        Effect.forEach(
          subscribersOf(event.kind),
          (id) =>
            dispatch(
              id,
              event.kind,
              apiValues(
                event.kind === "transcript"
                  ? { session: event.session, event: event.event }
                  : { session: event.session },
              ) as Json,
            ).pipe(
              Effect.catchTag("PluginHandlerFailed", ({ reason }) =>
                reportPluginFailure(id, reason),
              ),
              // Any other failure would end this loop, and no plugin would hear of an event again.
              Effect.catchCause((cause) =>
                reportPluginFailure(
                  id,
                  `A ${event.kind} event could not reach it: ${Cause.pretty(cause)}`,
                ),
              ),
            ),
          { discard: true },
        ),
      ),
      Effect.forever,
      Effect.forkScoped,
    )

    let before: Parameters<typeof settingChanges>[0] | null = null
    yield* services.pluginSettingChanges.pipe(
      Stream.runForEach((current) =>
        Effect.gen(function* () {
          const previous = before
          before = current
          if (previous === null) return
          for (const change of settingChanges(previous, current)) {
            if (!subscribers.get("settingChanged")?.has(change.pluginId)) continue
            yield* dispatch(change.pluginId, "settingChanged", {
              key: change.key,
              value: change.value,
            }).pipe(
              Effect.catchTag("PluginHandlerFailed", ({ reason }) =>
                reportPluginFailure(change.pluginId, reason),
              ),
            )
          }
        }),
      ),
      Effect.forkScoped,
    )

    return {
      // What a plugin registered goes with its deactivation: its handlers die in the host.
      forget: (id: string) =>
        Effect.suspend(() => {
          for (const set of subscribers.values()) set.delete(id)
          for (const [command, owner] of commands) if (owner === id) commands.delete(command)
          return scheduler.stopPlugin(id)
        }),
    }
  })
