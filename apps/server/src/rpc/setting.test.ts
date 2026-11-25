import { defaultSettingsFor } from "@ivin/contracts/setting"
import { Effect, Layer, Stream } from "effect"
import { expect, test } from "vitest"
import { SettingDefaults } from "../modules/setting/usecases/setting-defaults.ts"
import { SettingsFile } from "../modules/setting/usecases/settings-file.ts"
import { type Client, makeClient, serverLayer } from "./test-server.ts"

const withFile = <A, E>(
  text: string | null,
  use: (client: Client, file: SettingsFile["Service"]) => Effect.Effect<A, E>,
  version = "1.2.3",
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* makeClient()
      return yield* use(client, yield* SettingsFile)
    }).pipe(
      Effect.provide(
        serverLayer({ settings: [text] }).pipe(
          Layer.provide(Layer.succeed(SettingDefaults)(defaultSettingsFor(version))),
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
  expect(result.section).toEqual({ stopAgentOnClose: false, newTabPosition: "end" })
  expect(result.all).toMatchObject({
    tabs: { stopAgentOnClose: false, newTabPosition: "end" },
    worktrees: { removeOnTabClose: true },
  })
})

test("a beta server gets beta versions until the file turns them off", async () => {
  const beta = await withFile(
    null,
    (client) => client["setting.get"]({ path: "updates.beta" }),
    "0.1.0-beta.0",
  )
  const off = await withFile(
    '{ "updates": { "beta": false } }',
    (client) =>
      client["setting.watch"]().pipe(
        Stream.filter(({ settings }) => !settings.updates.beta),
        Stream.runHead,
      ),
    "0.1.0-beta.0",
  )

  expect(beta).toBe(true)
  expect(off._tag).toBe("Some")
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

  expect(result.unknown).toMatchObject({
    _tag: "SettingPathUnknown",
    path: "tabs.nope",
    knownPaths: expect.arrayContaining(["tabs.stopAgentOnClose", "files.file.placement"]),
  })
  expect(result.invalid).toMatchObject({
    _tag: "SettingValueInvalid",
    path: "tabs.stopAgentOnClose",
    expected: "boolean",
  })
  expect(result.unknownGet).toMatchObject({ _tag: "SettingPathUnknown", path: "nope" })
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
