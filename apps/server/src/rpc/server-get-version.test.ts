import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vite-plus/test"
import { ServerRpcs } from "@ivin/contracts/server"
import { ServerInfo } from "../shared/server-info.ts"
import { handlers } from "./handlers.ts"

test("server.getVersion answers with the version the server was built with", async () => {
  const program = Effect.gen(function* () {
    const client = yield* RpcTest.makeClient(ServerRpcs)
    return yield* client["server.getVersion"]()
  }).pipe(
    Effect.provide(handlers.pipe(Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })))),
    Effect.scoped,
  )

  expect(await Effect.runPromise(program)).toEqual({ version: "1.2.3" })
})
