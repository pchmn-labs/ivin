import { MessageChannel } from "node:worker_threads"
import { Cause, Effect, Exit } from "effect"
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

test("a request in flight when the connection is lost fails with a message", async () => {
  const { port1, port2 } = new MessageChannel()
  let lose: () => void = () => {}
  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(ServerRpcs)
    return yield* client["server.getVersion"]().pipe(Effect.exit)
  }).pipe(
    Effect.provide(
      layerClientProtocolMessagePort({
        onMessage: (handler) => port1.on("message", handler),
        postMessage: (data) => port1.postMessage(data),
        onLost: (handler) => (lose = handler),
      }),
    ),
    Effect.scoped,
  )

  // The server never answers: it is gone once it has received the request.
  port2.once("message", () => lose())
  const failure = Effect.runPromise(program)

  const exit = await failure
  expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain("ivin's server stopped")
  port1.close()
  port2.close()
})
