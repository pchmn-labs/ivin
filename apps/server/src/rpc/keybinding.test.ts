import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers, layerServices } from "./handlers.ts"

const watchWhileFileIs = (texts: ReadonlyArray<string | null>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(Rpcs)
      return yield* client["keybinding.watch"]().pipe(Stream.take(texts.length), Stream.runCollect)
    }).pipe(
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(layerDatabase(":memory:")),
          Layer.provide(layerScripted([])),
          Layer.provide(layerKeybindingsFileOf(texts)),
          Layer.provide(layerSettingsFileOf([])),
        ),
      ),
      Effect.scoped,
    ),
  )

const toggleOnB = { key: "mod+b", command: "sidebar.toggle", when: null }

test("keybinding.watch sends the user's keybindings, and keeps them while the file is invalid", async () => {
  const states = await watchWhileFileIs([
    null,
    `[{ "key": "mod+b", "command": "sidebar.toggle" }]`,
    "[{",
    "[]",
  ])

  expect(states).toEqual([
    { keybindings: [], problem: null },
    { keybindings: [toggleOnB], problem: null },
    { keybindings: [toggleOnB], problem: { reason: "notJson", entry: null } },
    { keybindings: [], problem: null },
  ])
})
