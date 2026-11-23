import { layerScripted } from "@ivin/harness"
import { Effect, Layer, Stream } from "effect"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { KeybindingsFile } from "../modules/keybinding/usecases/keybindings-file.ts"
import { SettingsFile } from "../modules/setting/usecases/settings-file.ts"
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

test("a handler that dies fails only its own request, and the connection's other stream keeps running", async () => {
  const layerKeybindings = Layer.succeed(KeybindingsFile)({
    path: "/home/.ivin/keybindings.json",
    contents: Stream.make(null).pipe(Stream.concat(Stream.never)),
  })
  const layerBrokenSettings = Layer.succeed(SettingsFile)({
    path: "/home/.ivin/settings.json",
    contents: Stream.make(null).pipe(Stream.concat(Stream.never)),
    read: Effect.die("unreadable"),
    edit: () => Effect.die("defect"),
  })
  let receive: (data: unknown) => void = () => {}
  let close: () => void = () => {}
  const sent: Array<{ _tag: string; requestId?: string; exit?: { _tag: string } }> = []
  const port = {
    onMessage: (handler: (data: unknown) => void) => (receive = handler),
    onClose: (handler: () => void) => (close = handler),
    postMessage: (data: string) => void sent.push(JSON.parse(data)),
  }
  const request = (id: string, tag: string, payload: unknown) =>
    receive(JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }))

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
              layerBrokenSettings,
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  )

  await vi.waitFor(() => expect(receive).not.toBe(undefined))
  await vi.waitFor(() => {
    request("1", "keybinding.watch", null)
    expect(sent.some((message) => message.requestId === "1")).toBe(true)
  })
  request("2", "setting.set", { path: "tabs.stopAgentOnClose", value: false })
  await vi.waitFor(() =>
    expect(sent.find((m) => m._tag === "Exit" && m.requestId === "2")?.exit?._tag).toBe("Failure"),
  )

  const before = sent.length
  request("3", "setting.get", { path: null })
  await vi.waitFor(() =>
    expect(sent.find((m) => m._tag === "Exit" && m.requestId === "3")?.exit?._tag).toBe("Success"),
  )
  expect(sent.length).toBeGreaterThan(before)
  expect(sent.some((m) => m._tag === "Exit" && m.requestId === "1")).toBe(false)

  close()
  await serving
})
