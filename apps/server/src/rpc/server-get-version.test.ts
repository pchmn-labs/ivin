import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { ServerRpcs } from "@ivin/contracts/server"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers } from "./handlers.ts"

test("server.getVersion answers with the version the server was built with", async () => {
  const program = Effect.gen(function* () {
    const client = yield* RpcTest.makeClient(ServerRpcs)
    return yield* client["server.getVersion"]()
  }).pipe(
    Effect.provide(
      handlers.pipe(
        Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
        Layer.provide(layerDatabase(":memory:")),
        Layer.provide(layerScripted([])),
      ),
    ),
    Effect.scoped,
  )

  expect(await Effect.runPromise(program)).toEqual({ version: "1.2.3" })
})
