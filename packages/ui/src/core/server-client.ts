import { Rpcs } from "@ivin/contracts/rpcs"
import { layerClientProtocolMessagePort } from "@ivin/state/rpc-client-protocol"
import { Cause, Context, Effect, Layer, Stream } from "effect"
import { RpcClient, RpcClientError } from "effect/rpc"
import { Atom } from "effect/reactivity"
import "./desktop-bridge.ts"
import { errorReport } from "../modules/log/rules/error-report.ts"

export class ServerClient extends Context.Service<
  ServerClient,
  RpcClient.FromGroup<typeof Rpcs, RpcClientError.RpcClientError>
>()("ivin/ui/ServerClient") {}

// The preload answers this window message with a port to the server, see apps/desktop/src/preload.ts.
const requestServerPort = (signal: AbortSignal) =>
  new Promise<MessagePort>((resolve) => {
    // The id keeps a client that is still waiting from taking the port the next one asked for.
    const id = crypto.randomUUID()
    const onMessage = (event: MessageEvent) => {
      const [port] = event.ports
      const data = event.data as { type?: unknown; id?: unknown } | null
      if (event.source !== window || data?.type !== "ivin:rpc-port" || data.id !== id || !port) {
        return
      }
      window.removeEventListener("message", onMessage)
      resolve(port)
    }
    window.addEventListener("message", onMessage)
    signal.addEventListener("abort", () => window.removeEventListener("message", onMessage))
    window.postMessage({ type: "ivin:request-rpc-port", id }, "*")
  })

// A new layer each time: layers are memoized by identity, and a restarted server needs a new port.
export const makeServerClientLayer = () =>
  Layer.effect(ServerClient)(
    Effect.gen(function* () {
      const port = yield* Effect.acquireRelease(Effect.promise(requestServerPort), (port) =>
        Effect.sync(() => port.close()),
      )
      return yield* RpcClient.make(Rpcs).pipe(
        Effect.provide(
          layerClientProtocolMessagePort({
            onMessage: (handler) => {
              port.onmessage = (event) => handler(event.data)
            },
            postMessage: (data) => port.postMessage(data),
            onLost: (handler) =>
              window.ivin.onServerState((state) => {
                if (state.kind !== "running") handler()
              }),
          }),
        ),
      )
    }),
  )

const reportRpcFailures = (client: ServerClient["Service"]): ServerClient["Service"] => {
  const report = (action: string) => (cause: Cause.Cause<unknown>) =>
    Cause.hasInterruptsOnly(cause)
      ? Effect.void
      : client["log.writeError"](errorReport(action, Cause.squash(cause))).pipe(Effect.ignore)

  return new Proxy(client, {
    get: (target, key, receiver) => {
      const value: unknown = Reflect.get(target, key, receiver)
      // A failed report is not reported again, or a lost server would loop.
      if (typeof key !== "string" || key === "log.writeError" || typeof value !== "function") {
        return value
      }
      return (...args: Array<unknown>) => {
        const result: unknown = value.apply(target, args)
        if (Stream.isStream(result)) return result.pipe(Stream.tapCause(report(key)))
        if (Effect.isEffect(result)) return result.pipe(Effect.tapCause(report(key)))
        return result
      }
    },
  })
}

const reportingRpcFailures = <E, R>(layer: Layer.Layer<ServerClient, E, R>) =>
  Layer.effect(ServerClient)(
    Effect.gen(function* () {
      return reportRpcFailures(yield* ServerClient)
    }),
  ).pipe(Layer.provide(layer))

// Tests replace this layer through the registry's initial values.
export const serverClientLayerAtom = Atom.make(makeServerClientLayer())

export const serverRuntime = Atom.runtime((get) => reportingRpcFailures(get(serverClientLayerAtom)))
