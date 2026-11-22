import { Effect, Queue, Stream } from "effect"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { SettingsFile } from "../usecases/settings-file.ts"
import { layerFsSettingsFile } from "./fs-settings-file.ts"

const tempHome = () => join(mkdtempSync(join(tmpdir(), "ivin-home-")), ".ivin")

test("an edit writes the file through a rename, and the watcher sees the new text", async () => {
  const home = tempHome()
  const program = Effect.gen(function* () {
    const file = yield* SettingsFile
    const seen = yield* Queue.unbounded<string | null>()
    yield* file.contents.pipe(
      Stream.runForEach((text) => Queue.offer(seen, text)),
      Effect.forkScoped,
    )
    const next = Queue.take(seen).pipe(Effect.timeout("2 seconds"))
    const first = yield* next
    yield* file.edit((text) => Effect.succeed(`${text ?? "{}"} `))
    return [first, yield* next, yield* file.read]
  }).pipe(Effect.provide(layerFsSettingsFile(home)), Effect.scoped)

  expect(await Effect.runPromise(program)).toEqual([null, "{} ", "{} "])
  expect(readFileSync(join(home, "settings.json"), "utf8")).toBe("{} ")
  expect(readdirSync(home)).toEqual(["settings.json"])
})

test("an edit that fails leaves the file as it was", async () => {
  const home = tempHome()
  const program = Effect.gen(function* () {
    mkdirSync(home)
    writeFileSync(join(home, "settings.json"), "{ // mine\n}")
    const file = yield* SettingsFile
    return yield* file.edit(() => Effect.fail("refused" as const)).pipe(Effect.flip)
  }).pipe(Effect.provide(layerFsSettingsFile(home)), Effect.scoped)

  expect(await Effect.runPromise(program)).toBe("refused")
  expect(readFileSync(join(home, "settings.json"), "utf8")).toBe("{ // mine\n}")
  expect(readdirSync(home)).toEqual(["settings.json"])
})
