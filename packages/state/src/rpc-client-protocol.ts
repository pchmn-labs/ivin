import { Effect, Layer } from "effect"
import { RpcClient, RpcMessage, RpcSerialization } from "effect/rpc"

export interface RpcPort {
  readonly onMessage: (handler: (data: unknown) => void) => void
  readonly postMessage: (data: string) => void
  // Called when the server behind the port is gone: requests still waiting for an answer end with an error.
  readonly onLost?: (handler: () => void) => () => void
}

export const layerClientProtocolMessagePort = (port: RpcPort): Layer.Layer<RpcClient.Protocol> => {
  const serialization = RpcSerialization.json
  return Layer.effect(RpcClient.Protocol)(
    RpcClient.Protocol.make(
      Effect.fnUntraced(function* (writeResponse, clientIds) {
        const parser = serialization.makeUnsafe()
        const context = yield* Effect.context<never>()
        const run = Effect.runForkWith(context)

        port.onMessage((data) => {
          if (typeof data !== "string") return
          for (const message of parser.decode(
            data,
          ) as ReadonlyArray<RpcMessage.FromServerEncoded>) {
            for (const clientId of clientIds) run(writeResponse(clientId, message))
          }
        })

        const stopListening = port.onLost?.(() => {
          const defect: RpcMessage.FromServerEncoded = {
            _tag: "Defect",
            defect: "ivin's server stopped",
          } as RpcMessage.FromServerEncoded
          for (const clientId of clientIds) run(writeResponse(clientId, defect))
        })

        if (stopListening) yield* Effect.addFinalizer(() => Effect.sync(stopListening))

        return {
          send: (_clientId, request) =>
            Effect.sync(() => {
              const encoded = parser.encode(request)
              if (encoded !== undefined) port.postMessage(encoded as string)
            }),
          supportsAck: true,
          supportsTransferables: false,
          codecFor: serialization.codecFor,
        }
      }),
    ),
  )
}
