import { layerScripted, scriptedRunOptions } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { ServerRpcs } from "@ivin/contracts/server"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers, layerServices } from "./handlers.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"

const makeClient = () => RpcTest.makeClient(ServerRpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E>) =>
  makeClient().pipe(
    Effect.flatMap(use),
    Effect.provide(
      handlers.pipe(
        Layer.provide(layerServices),
        Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
        Layer.provide(layerDatabase(":memory:")),
        Layer.provide(layerKeybindingsFileOf([])),
        Layer.provide(layerSettingsFileOf([])),
        Layer.provide(layerScripted([])),
      ),
    ),
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
