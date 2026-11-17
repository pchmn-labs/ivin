import { MessageChannel } from "node:worker_threads"
import { Effect } from "effect"
import { RpcClient } from "effect/rpc"
import { expect, test } from "vitest"
import { ServerRpcs } from "@ivin/contracts/server"
import { layerClientProtocolMessagePort } from "./rpc-client-protocol.ts"

test("a client calls an rpc over a message port", async () => {
  const { port1, port2 } = new MessageChannel()
  port2.on("message", (data: string) => {
    const { id } = JSON.parse(data)
    port2.postMessage(
      JSON.stringify({
        _tag: "Exit",
        requestId: id,
        exit: { _tag: "Success", value: { version: "3.0.0" } },
      }),
    )
  })

  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(ServerRpcs)
    return yield* client["server.getVersion"]()
  }).pipe(
    Effect.provide(
      layerClientProtocolMessagePort({
        onMessage: (handler) => port1.on("message", handler),
        postMessage: (data) => port1.postMessage(data),
      }),
    ),
    Effect.scoped,
  )

  expect(await Effect.runPromise(program)).toEqual({ version: "3.0.0" })
  port1.close()
  port2.close()
})
