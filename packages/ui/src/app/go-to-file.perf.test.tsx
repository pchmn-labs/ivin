import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { App } from "./app.tsx"

// No gap between two frames may last two frames at 60 Hz, a dropped frame being 33 ms.
const FRAME_BUDGET_MS = 30
const FOLDERS = 500
const FILES_PER_FOLDER = 100
const QUERY = "componen"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

test("typing 8 keys in Go to file over 50,000 paths while changes arrive keeps every frame under budget and lists the files a bounded number of times", async () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({ id: "s1", title: "Big", projectPath: project, workingFolder: project }),
  )
  const folders = Array.from({ length: FOLDERS }, (_, f) => `folder-${f}`)
  server.folders.set(
    project,
    folders.map((name): FolderEntry => ({ name, kind: "folder", ignored: false })),
  )
  for (const [f, name] of folders.entries())
    server.folders.set(
      `${project}/${name}`,
      Array.from({ length: FILES_PER_FOLDER }, (_, i) => ({
        name: `component-${f}-${i}.tsx`,
        kind: "file" as const,
        ignored: false,
      })),
    )
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 800 }}>
        <App />
      </div>
    </RegistryProvider>,
  )
  await userEvent.keyboard(`{${mod}>}p{/${mod}}`)
  const field = page.getByRole("combobox", { name: "Go to file" })
  await expect.element(field).toHaveFocus()
  await expect.element(page.getByText("50,000 files")).toBeVisible()
  const listedBefore = server.fileListings()

  // Every gap between two frames from the first key to the last row drawn, a stalled one included.
  let worst = 0
  let recording = true
  const recorder = (async () => {
    let last = await nextFrame()
    while (recording) {
      const now = await nextFrame()
      worst = Math.max(worst, now - last)
      last = now
    }
  })()
  for (const [at, key] of Array.from(QUERY).entries()) {
    server.changeOnDisk(project, [`folder-${at}/component-${at}-0.tsx`])
    await userEvent.keyboard(key)
    await expect.element(field).toHaveValue(QUERY.slice(0, at + 1))
  }
  await expect.element(page.getByRole("option").first()).toBeVisible()
  recording = false
  await recorder

  expect(worst).toBeLessThan(FRAME_BUDGET_MS)
  expect(server.fileListings() - listedBefore).toBeLessThanOrEqual(QUERY.length)
})
