import { scriptedRunOptions } from "@ivin/harness"
import { Effect } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { ServerRpcs } from "@ivin/contracts/server"
import { serverLayer } from "./test-server.ts"

const makeClient = () => RpcTest.makeClient(ServerRpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E>) =>
  makeClient().pipe(
    Effect.flatMap(use),
    Effect.provide(serverLayer()),
    Effect.scoped,
    Effect.runPromise,
  )

test("server.getVersion answers with the version the server was built with", async () => {
  expect(await withServer((client) => client["server.getVersion"]())).toEqual({ version: "1.2.3" })
})

test("server.getHarness answers with the harness of the server's provider and its run options", async () => {
  expect(await withServer((client) => client["server.getHarness"]())).toEqual({
    id: "scripted",
    runOptions: scriptedRunOptions,
  })
})
