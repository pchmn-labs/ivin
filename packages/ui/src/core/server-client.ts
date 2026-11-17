import { Rpcs } from "@ivin/contracts/rpcs"
import { layerClientProtocolMessagePort } from "@ivin/state/rpc-client-protocol"
import { Context, Effect, Layer } from "effect"
import { RpcClient, RpcClientError } from "effect/rpc"
import { Atom } from "effect/reactivity"

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

// Tests replace this layer through the registry's initial values.
export const serverClientLayerAtom = Atom.make(serverClientLayer)

export const serverRuntime = Atom.runtime((get) => get(serverClientLayerAtom))
