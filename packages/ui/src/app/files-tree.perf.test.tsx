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

// Below 30 frames a second, scrolling the tree visibly stutters.
const MIN_FPS = 30
const FRAMES = 120
// A batch from the watcher every this many frames, faster than the server's debounce allows.
const CHANGE_EVERY = 6

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

test("scrolling a 5,000-file tree keeps the frame rate while the disk and git status change", async () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({ id: "s1", title: "Big", projectPath: project, workingFolder: project }),
  )
  const folders = Array.from({ length: 50 }, (_, f) => `folder-${f}`)
  server.folders.set(
    project,
    folders.map((name): FolderEntry => ({ name, kind: "folder", ignored: false })),
  )
  for (const [f, name] of folders.entries())
    server.folders.set(
      `${project}/${name}`,
      Array.from({ length: 100 }, (_, i) => ({
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
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await page.getByRole("button", { name: "Filter files", exact: true }).click()
  // The filter opens every folder that holds a match: 50 folders and their 5,000 files.
  await page.getByRole("textbox", { name: "Filter files by name" }).fill("component")
  await expect.element(page.getByRole("treeitem", { name: "component-0-0.tsx" })).toBeVisible()
  const scroller = document.querySelector<HTMLElement>(".iv-tree__list")!
  const step = (scroller.scrollHeight - scroller.clientHeight) / FRAMES

  const start = await nextFrame()
  let last = start
  for (let frame = 1; frame <= FRAMES; frame++) {
    scroller.scrollTop = step * frame
    if (frame % CHANGE_EVERY === 0) {
      const path = `folder-${frame % 50}/component-${frame % 50}-${frame}.tsx`
      server.gitStatus.set(project, [{ path, status: "modified" }])
      server.changeOnDisk(project, [path])
    }
    last = await nextFrame()
  }

  expect(scroller.scrollTop).toBeGreaterThan(5000 * 20)
  const fps = (FRAMES * 1000) / (last - start)
  expect(fps).toBeGreaterThan(MIN_FPS)
})
