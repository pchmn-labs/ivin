import { Effect, Queue, Stream } from "effect"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { KeybindingsFile } from "../usecases/keybindings-file.ts"
import { layerFsKeybindingsFile } from "./fs-keybindings-file.ts"

test("the file's text is read when watched and after each change, null when it is absent", async () => {
  const home = join(mkdtempSync(join(tmpdir(), "ivin-home-")), ".ivin")
  const path = join(home, "keybindings.json")
  const program = Effect.gen(function* () {
    const file = yield* KeybindingsFile
    const seen = yield* Queue.unbounded<string | null>()
    yield* file.contents.pipe(
      Stream.runForEach((text) => Queue.offer(seen, text)),
      Effect.forkScoped,
    )
    const next = Queue.take(seen).pipe(Effect.timeout("2 seconds"))
    const first = yield* next
    writeFileSync(path, "[1]")
    const written = yield* next
    rmSync(path)
    const removed = yield* next
    return [first, written, removed]
  }).pipe(Effect.provide(layerFsKeybindingsFile(home)), Effect.scoped)

  expect(await Effect.runPromise(program)).toEqual([null, "[1]", null])
})
