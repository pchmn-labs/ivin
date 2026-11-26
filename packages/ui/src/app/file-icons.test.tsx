import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { folder, mountApp } from "./test-app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const project = "/dev/shop"

const makeServer = (): FakeServer => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({ id: "s1", title: "Checkout", projectPath: project, workingFolder: project }),
  )
  server.folders.set(project, folder("src/", "stuff/", "main.ts", "grammar.p6"))
  server.folders.set(`${project}/src`, folder())
  server.openTab("s1")
  return server
}

const mount = async (server = makeServer()) => {
  await mountApp(server, { height: 800 })
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
