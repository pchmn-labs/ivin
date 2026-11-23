import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf, SettingsFile } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { handlers, layerServices } from "./handlers.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withFile = <A, E>(
  text: string | null,
  use: (client: Client, file: SettingsFile["Service"]) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* makeClient()
      return yield* use(client, yield* SettingsFile)
    }).pipe(
      Effect.provide(
        handlers.pipe(
          Layer.provideMerge(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(layerDatabase(":memory:")),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerScripted([])),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provideMerge(layerSettingsFileOf([text])),
        ),
      ),
      Effect.scoped,
    ),
  )

const text = `{
  // Keep agents running.
  "tabs": { "stopAgentOnClose": true },
}
`

test("setting.set writes the value, and setting.watch and setting.get then give it", async () => {
  const result = await withFile(text, (client, file) =>
    Effect.gen(function* () {
      yield* client["setting.set"]({ path: "tabs.stopAgentOnClose", value: false })
      const watched = yield* client["setting.watch"]().pipe(
        Stream.filter(({ settings }) => !settings.tabs.stopAgentOnClose),
        Stream.runHead,
      )
      return {
        text: yield* file.read,
        watched,
        leaf: yield* client["setting.get"]({ path: "tabs.stopAgentOnClose" }),
        section: yield* client["setting.get"]({ path: "tabs" }),
        all: yield* client["setting.get"]({ path: null }),
      }
    }),
  )

  expect(result.text).toBe(text.replace("true", "false"))
  expect(result.watched._tag).toBe("Some")
  expect(result.leaf).toBe(false)
  expect(result.section).toEqual({ stopAgentOnClose: false })
  expect(result.all).toEqual({
    tabs: { stopAgentOnClose: false },
    worktrees: { removeOnTabClose: true },
    files: { folderIcons: true },
    sidebar: { layout: "rail" },
  })
})

test("an unknown path or a value of the wrong type is refused, and the file is untouched", async () => {
  const result = await withFile(text, (client, file) =>
    Effect.gen(function* () {
      const unknown = yield* client["setting.set"]({ path: "tabs.nope", value: true }).pipe(
        Effect.flip,
      )
      const invalid = yield* client["setting.set"]({
        path: "tabs.stopAgentOnClose",
        value: "maybe",
      }).pipe(Effect.flip)
      const unknownGet = yield* client["setting.get"]({ path: "nope" }).pipe(Effect.flip)
      return { unknown, invalid, unknownGet, text: yield* file.read }
    }),
  )

  const knownPaths = [
    "tabs.stopAgentOnClose",
    "worktrees.removeOnTabClose",
    "files.folderIcons",
    "sidebar.layout",
  ]
  expect(result.unknown).toMatchObject({
    _tag: "SettingPathUnknown",
    path: "tabs.nope",
    knownPaths,
  })
  expect(result.invalid).toMatchObject({
    _tag: "SettingValueInvalid",
    path: "tabs.stopAgentOnClose",
    expected: "boolean",
  })
  expect(result.unknownGet).toMatchObject({ _tag: "SettingPathUnknown", path: "nope", knownPaths })
  expect(result.text).toBe(text)
})

test("a file that is not JSON is refused with its parse error and left as it is", async () => {
  const broken = `{\n  "tabs": {}\n  "worktrees": {}\n}`
  const result = await withFile(broken, (client, file) =>
    Effect.gen(function* () {
      const error = yield* client["setting.set"]({
        path: "tabs.stopAgentOnClose",
        value: false,
      }).pipe(Effect.flip)
      return { error, text: yield* file.read }
    }),
  )

  expect(result.error).toMatchObject({
    _tag: "SettingsFileInvalid",
    path: "/home/.ivin/settings.json",
    reason: "notJson",
    parseError: { code: "CommaExpected", line: 3, column: 3 },
  })
  expect(result.text).toBe(broken)
})
