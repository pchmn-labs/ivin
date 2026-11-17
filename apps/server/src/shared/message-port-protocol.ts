import { Effect, Layer, Queue } from "effect"
import { RpcMessage, RpcSerialization, RpcServer } from "effect/rpc"

export interface RpcPort {
  readonly onMessage: (handler: (data: unknown) => void) => void
  readonly postMessage: (data: string) => void
}

// One port carries one client, always id 0.
export const layerProtocolMessagePort = (port: RpcPort): Layer.Layer<RpcServer.Protocol> => {
  const serialization = RpcSerialization.json
  return Layer.effect(RpcServer.Protocol)(
    RpcServer.Protocol.make(
      Effect.fnUntraced(function* (writeRequest) {
        const parser = serialization.makeUnsafe()
        const context = yield* Effect.context<never>()
        const run = Effect.runForkWith(context)

        port.onMessage((data) => {
          if (typeof data !== "string") return
          for (const message of parser.decode(
            data,
          ) as ReadonlyArray<RpcMessage.FromClientEncoded>) {
            run(writeRequest(0, message))
          }
        })

        return {
          disconnects: yield* Queue.make<number>(),
          send: (_clientId, response) =>
            Effect.sync(() => {
              const encoded = parser.encode(response)
              if (encoded !== undefined) port.postMessage(encoded as string)
            }),
          end: () => Effect.void,
          clientIds: Effect.succeed(new Set([0])),
          initialMessage: Effect.succeedNone,
          supportsAck: true,
          supportsTransferables: false,
          supportsSpanPropagation: true,
          supportsNotifications: true,
          codecFor: serialization.codecFor,
        }
      }),
    ),
  )
}
