import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import type * as RankFiles from "../../../../plugins/files/src/rules/rank-files.ts"
import { App } from "./app.tsx"

const FRAME_BUDGET_MS = 1000 / 60
const FOLDERS = 500
const FILES_PER_FOLDER = 100
const QUERY = "componen"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"

const rankings = vi.hoisted(() => new Map<string, number>())

vi.mock("../../../../plugins/files/src/rules/rank-files.ts", async (load) => {
  const actual = await load<typeof RankFiles>()
  return {
    ...actual,
    rankFiles: (...args: Parameters<typeof actual.rankFiles>) => {
      const started = performance.now()
      const ranked = actual.rankFiles(...args)
      rankings.set(args[1], performance.now() - started)
      return ranked
    },
  }
})

test("typing 8 keys in Go to file over 50,000 paths while changes arrive ranks each key within a frame and lists the files a bounded number of times", async () => {
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
  for (const [at, key] of Array.from(QUERY).entries()) {
    server.changeOnDisk(project, [`folder-${at}/component-${at}-0.tsx`])
    await userEvent.keyboard(key)
    await expect.element(field).toHaveValue(QUERY.slice(0, at + 1))
  }
  await expect.element(page.getByRole("option").first()).toBeVisible()

  const typed = Array.from(QUERY, (_, at) => QUERY.slice(0, at + 1))
  expect([...rankings.keys()]).toEqual(expect.arrayContaining(typed))
  for (const query of typed) expect(rankings.get(query)).toBeLessThan(FRAME_BUDGET_MS)
  expect(server.fileListings() - listedBefore).toBeLessThanOrEqual(QUERY.length)
})
