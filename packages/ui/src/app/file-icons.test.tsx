import { RegistryProvider } from "@effect/atom-react"
import type { FolderEntry } from "@ivin/contracts/file"
import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"

const folder = (...names: string[]): ReadonlyArray<FolderEntry> =>
  names.map((name) =>
    name.endsWith("/")
      ? { name: name.slice(0, -1), kind: "folder", ignored: false }
      : { name, kind: "file", ignored: false },
  )

const makeServer = (): FakeServer => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({ id: "s1", title: "Checkout", projectPath: project, workingFolder: project }),
  )
  server.folders.set(
    project,
    folder("src/", "stuff/", "package.json", "app.test.ts", "main.ts", "grammar.p6", "notes.zzz"),
  )
  server.folders.set(`${project}/src`, folder())
  server.openTab("s1")
  return server
}

const mount = async (server = makeServer()) => {
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 800 }}>
        <App />
      </div>
    </RegistryProvider>,
  )
  await userEvent.keyboard(`{${mod}>}2{/${mod}}`)
  await expect.element(item("main.ts")).toBeVisible()
  return server
}

const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const iconBox = (name: string) => item(name).element().querySelector(".iv-tree__icon")
const iconOf = (name: string) =>
  item(name).element().querySelector(".iv-tree__icon img")?.getAttribute("src")
const icon = (file: string) => `ivin-plugin://file-icons/icons/${file}.svg`

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("the Files tab shows the icon theme's icon for each file and folder", async () => {
  await mount()

  await expect.poll(() => iconOf("package.json")).toBe(icon("nodejs"))
  expect(iconOf("app.test.ts")).toBe(icon("test-ts"))
  expect(iconOf("main.ts")).toBe(icon("typescript"))
  expect(iconOf("grammar.p6")).toBe(icon("perl"))
  expect(iconOf("notes.zzz")).toBe(icon("file"))
  expect(iconOf("src")).toBe(icon("folder-src"))
  expect(iconOf("stuff")).toBe(icon("folder"))

  await item("src").click()
  await expect.element(item("src")).toHaveAttribute("aria-expanded", "true")
  await expect.poll(() => iconOf("src")).toBe(icon("folder-src-open"))
})

test("with folder icons turned off in the settings, a folder shows no icon and files keep theirs", async () => {
  const server = await mount()
  await expect.poll(() => iconOf("src")).toBe(icon("folder-src"))

  const folderIcons = (on: boolean) =>
    server.setUserSettings({
      settings: { ...defaultSettings, files: { folderIcons: on } },
      problem: null,
    })
  folderIcons(false)
  await expect.poll(() => iconBox("src")).toBeNull()
  expect(iconBox("stuff")).toBeNull()
  expect(iconOf("main.ts")).toBe(icon("typescript"))

  folderIcons(true)
  await expect.poll(() => iconOf("src")).toBe(icon("folder-src"))
})
