import { Rpcs } from "@ivin/contracts/rpcs"
import { layerClientProtocolMessagePort } from "@ivin/state/rpc-client-protocol"
import { Cause, Context, Effect, Layer, Stream } from "effect"
import { RpcClient, RpcClientError } from "effect/rpc"
import { Atom } from "effect/reactivity"
import { errorReport } from "../modules/log/rules/error-report.ts"

export class ServerClient extends Context.Service<
  ServerClient,
  RpcClient.FromGroup<typeof Rpcs, RpcClientError.RpcClientError>
>()("ivin/ui/ServerClient") {}

// The preload answers this window message with a port to the server, see apps/desktop/src/preload.ts.
const requestServerPort = () =>
  new Promise<MessagePort>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const [port] = event.ports
      if (event.source !== window || event.data !== "ivin:rpc-port" || !port) return
      window.removeEventListener("message", onMessage)
      resolve(port)
    }
    window.addEventListener("message", onMessage)
    window.postMessage("ivin:request-rpc-port", "*")
  })

const serverClientLayer = Layer.unwrap(
  Effect.promise(requestServerPort).pipe(
    Effect.map((port) =>
      Layer.effect(ServerClient)(RpcClient.make(Rpcs)).pipe(
        Layer.provide(
          layerClientProtocolMessagePort({
            onMessage: (handler) => {
              port.onmessage = (event) => handler(event.data)
            },
            postMessage: (data) => port.postMessage(data),
          }),
        ),
      ),
    ),
  ),
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
export const serverClientLayerAtom = Atom.make(serverClientLayer)

export const serverRuntime = Atom.runtime((get) => reportingRpcFailures(get(serverClientLayerAtom)))
