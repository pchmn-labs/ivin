import { layerScripted } from "@ivin/harness"
import { Effect, Layer, Stream } from "effect"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { KeybindingsFile } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { layerServices } from "./handlers.ts"
import { serveOverClosingPort } from "./serve.ts"

test("closing a port ends the streams it opened", async () => {
  let watchEnded = false
  const layerKeybindings = Layer.succeed(KeybindingsFile)({
    path: "/home/.ivin/keybindings.json",
    contents: Stream.make(null).pipe(
      Stream.concat(Stream.never),
      Stream.ensuring(Effect.sync(() => (watchEnded = true))),
    ),
  })
  let receive: (data: unknown) => void = () => {}
  let close: () => void = () => {}
  const sent: string[] = []
  const port = {
    onMessage: (handler: (data: unknown) => void) => (receive = handler),
    onClose: (handler: () => void) => (close = handler),
    postMessage: (data: string) => void sent.push(data),
  }

  const serving = Effect.runPromise(
    serveOverClosingPort(port, { version: "1.2.3" }).pipe(
      Effect.provide(
        layerServices.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              layerDatabase(":memory:"),
              Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
              layerScripted([]),
              layerKeybindings,
              layerSettingsFileOf([]),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  )

  await vi.waitFor(() => expect(receive).not.toBe(undefined))
  await vi.waitFor(() => {
    receive(
      JSON.stringify({
        _tag: "Request",
        id: "1",
        tag: "keybinding.watch",
        payload: null,
        headers: [],
      }),
    )
    expect(sent.length).toBeGreaterThan(0)
  })
  expect(watchEnded).toBe(false)

  close()
  await serving
  expect(watchEnded).toBe(true)
})
