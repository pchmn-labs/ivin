import { layerScripted } from "@ivin/harness"
import { MessageChannel } from "node:worker_threads"
import { Effect, Layer } from "effect"
import { expect, test } from "vitest"
import { serveOverPort } from "../rpc/serve.ts"
import { layerDatabase } from "./adapters/database.ts"

test("serves the rpc group over a message port", async () => {
  const { port1, port2 } = new MessageChannel()
  const reply = new Promise<unknown>((resolve) => port2.once("message", resolve))

  const server = serveOverPort(
    {
      onMessage: (handler) => port1.on("message", handler),
      postMessage: (data) => port1.postMessage(data),
    },
    { version: "9.9.9" },
  )

  await Effect.runPromise(
    Effect.gen(function* () {
      yield* Layer.build(
        server.pipe(Layer.provide(layerDatabase(":memory:")), Layer.provide(layerScripted([]))),
      )
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
