import { MessageChannel } from "node:worker_threads"
import { Effect, Layer } from "effect"
import { RpcServer } from "effect/rpc"
import { expect, test } from "vite-plus/test"
import { ServerRpcs } from "@ivin/contracts/server"
import { handlers } from "../rpc/handlers.ts"
import { ServerInfo } from "./server-info.ts"
import { layerProtocolMessagePort } from "./message-port-protocol.ts"

test("serves the rpc group over a message port", async () => {
  const { port1, port2 } = new MessageChannel()
  const reply = new Promise<unknown>((resolve) => port2.once("message", resolve))

  const server = RpcServer.layer(ServerRpcs).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.succeed(ServerInfo)({ version: "9.9.9" })),
    Layer.provide(
      layerProtocolMessagePort({
        onMessage: (h) => port1.on("message", h),
        postMessage: (d) => port1.postMessage(d),
      }),
    ),
  )

  await Effect.runPromise(
    Effect.gen(function* () {
      yield* Layer.build(server)
      port2.postMessage(
        JSON.stringify({
          _tag: "Request",
          id: "1",
          tag: "server.getVersion",
          payload: null,
          headers: [],
        }),
      )
      const response = JSON.parse((yield* Effect.promise(() => reply)) as string)
      expect(response).toEqual({
        _tag: "Exit",
        requestId: "1",
        exit: { _tag: "Success", value: { version: "9.9.9" } },
      })
    }).pipe(Effect.scoped),
  )
  port1.close()
  port2.close()
})
