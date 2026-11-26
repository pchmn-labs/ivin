import { PluginHostRpcs } from "@ivin/contracts/plugin"
import { layerClientProtocolMessagePort } from "@ivin/state/rpc-client-protocol"
import { Deferred, Effect, Layer, Stream } from "effect"
import { RpcClient } from "effect/rpc"
import { spawn } from "node:child_process"
import {
  PluginHost,
  PluginHostNotStarted,
  type RunningPluginHost,
} from "../usecases/plugin-host.ts"

const START_TIMEOUT = "15 seconds"

// `runtime` runs `entry` as Node: the Electron binary in the desktop app, which `ELECTRON_RUN_AS_NODE` turns into Node.
export const layerChildPluginHost = (runtime: string, entry: string) =>
  Layer.succeed(PluginHost)({
    launch: Effect.gen(function* () {
      const child = yield* Effect.acquireRelease(
        Effect.sync(() =>
          spawn(runtime, [entry], {
            stdio: ["ignore", "inherit", "inherit", "ipc"],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
          }),
        ),
        (child) => Effect.sync(() => void child.kill("SIGKILL")),
      )
      const exited = yield* Deferred.make<string>()
      const ready = yield* Deferred.make<void>()
      child.on("error", (error) => Effect.runSync(Deferred.succeed(exited, error.message)))
      child.on("exit", (code, signal) =>
        Effect.runSync(
          Deferred.succeed(exited, signal === null ? `exit code ${code}` : `signal ${signal}`),
        ),
      )
      child.on("message", (message) => {
        if ((message as { type?: unknown } | null)?.type === "ready") {
          Effect.runSync(Deferred.succeed(ready, undefined))
        }
      })
      yield* Deferred.await(ready).pipe(
        Effect.raceFirst(
          Deferred.await(exited).pipe(
            Effect.flatMap((reason) => Effect.fail(new PluginHostNotStarted({ reason }))),
          ),
        ),
        Effect.timeoutOrElse({
          duration: START_TIMEOUT,
          orElse: () => Effect.fail(new PluginHostNotStarted({ reason: "it did not start" })),
        }),
      )
      const client = yield* RpcClient.make(PluginHostRpcs).pipe(
        Effect.provide(
          layerClientProtocolMessagePort({
            onMessage: (handler) => child.on("message", handler),
            postMessage: (data) => {
              // Sent to a host that just exited: its `exited` already says so.
              if (child.connected) child.send(data)
            },
          }),
        ),
      )
      // A channel that fails means the process is going: `exited` or the missed heartbeat then ends the run.
      const host: RunningPluginHost = {
        activate: (plugin) =>
          client["pluginHost.activate"](plugin).pipe(
            Effect.catchTag("RpcClientError", () => Effect.never),
          ),
        deactivate: (id) =>
          client["pluginHost.deactivate"]({ id }).pipe(
            Effect.catchTag("RpcClientError", () => Effect.void),
          ),
        ping: client["pluginHost.ping"]().pipe(
          Effect.catchTag("RpcClientError", () => Effect.never),
        ),
        logs: client["pluginHost.logs"]().pipe(
          Stream.catchTag("RpcClientError", () => Stream.empty),
        ),
        calls: client["pluginHost.calls"]().pipe(
          Stream.catchTag("RpcClientError", () => Stream.empty),
        ),
        reply: (reply) =>
          client["pluginHost.reply"]({ reply }).pipe(
            Effect.catchTag("RpcClientError", () => Effect.void),
          ),
        dispatch: (dispatch) =>
          client["pluginHost.dispatch"](dispatch).pipe(
            Effect.catchTag("RpcClientError", () => Effect.never),
          ),
        exited: Deferred.await(exited),
      }
      return host
    }),
  })
