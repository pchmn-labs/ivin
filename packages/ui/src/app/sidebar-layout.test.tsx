import { RegistryProvider } from "@effect/atom-react"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const rail = () => page.getByRole("navigation", { name: "Projects" })
const strip = () => page.getByRole("group", { name: "Projects" })
const projectName = () => page.getByTestId("project-name")
const layout = (value: "rail" | "strip") => ({
  settings: { ...defaultSettings, sidebar: { layout: value } },
  problem: null,
})

const mountApp = async (options: { layout?: "rail" | "strip"; failVersion?: boolean } = {}) => {
  const at = DateTime.makeUnsafe(0)
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: at },
  })
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/dev/other",
    workingFolder: "/dev/other",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "Other work",
    harness: "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    backgroundTasks: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })
  server.openProject("/dev/other")
  server.openTab("s1")
  server.openProject("/dev/ivin")
  if (options.layout !== undefined) server.setUserSettings(layout(options.layout))
  if (options.failVersion === true) server.failNextCall("server.getVersion")
  await page.viewport(1280, 800)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <App plugins={builtinPlugins} />
    </RegistryProvider>,
  )
  await expect.element(projectName()).toHaveTextContent("ivin")
  return server
}

test("choosing Strip in Settings lines the projects up at the sidebar's foot, and the file brings the rail back", async () => {
  const server = await mountApp()
  await expect.element(rail()).toBeVisible()

  await page.getByRole("button", { name: "Settings" }).click()
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Sidebar" })
    .click()
  await page.getByRole("combobox", { name: "Projects" }).selectOptions("strip")
  await page.getByRole("button", { name: "Back to sessions" }).click()

  await expect.element(strip()).toBeVisible()
  await expect.element(rail()).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: /switch project/ })).toBeVisible()

  server.setUserSettings(layout("rail"))
  await expect.element(rail()).toBeVisible()
  await expect.element(strip()).not.toBeInTheDocument()
})

test("in the strip, a project's button, the project menu, the arrows and the keys select a project", async () => {
  await mountApp({ layout: "strip" })
  const previous = page.getByRole("button", { name: "Previous project" })
  const next = page.getByRole("button", { name: "Next project" })
  await expect.element(previous).toBeDisabled()

  await next.click()
  await expect.element(projectName()).toHaveTextContent("other")
  await expect.element(next).toBeDisabled()

  await userEvent.keyboard(`{Control>}{${mod}>}[[{/${mod}}{/Control}`)
  await expect.element(projectName()).toHaveTextContent("ivin")
  await userEvent.keyboard(`{Control>}{${mod}>}]{/${mod}}{/Control}`)
  await expect.element(projectName()).toHaveTextContent("other")

  await strip().getByRole("button", { name: "ivin", exact: true }).click()
  await expect.element(projectName()).toHaveTextContent("ivin")

  await page.getByRole("button", { name: /switch project/ }).click()
  await page.getByRole("menuitemradio", { name: /other/ }).click()
  await expect.element(projectName()).toHaveTextContent("other")
})

test("a project with sessions waiting on the user says how many in the strip and the menu", async () => {
  const server = await mountApp({ layout: "strip" })
  await expect.element(strip().getByRole("button", { name: "other", exact: true })).toBeVisible()

  server.setStatus("s1", "waiting")
  await expect
    .element(strip().getByRole("button", { name: "other · 1 waiting for you" }))
    .toBeVisible()
  await page.getByRole("button", { name: /switch project/ }).click()
  await expect
    .element(page.getByRole("menuitemradio", { name: "other · 1 waiting for you" }))
    .toBeVisible()
})

test("the gear sits in the sidebar's top row in both layouts and shows when the server is lost", async () => {
  await mountApp({ layout: "strip", failVersion: true })
  const top = page.getByTestId("sidebar-top-row")
  await expect.element(top.getByRole("button", { name: "Settings" })).toBeVisible()
  await expect.element(top.getByTestId("server-lost")).toBeVisible()
})

test("with the rail, the gear is in the top row and nothing shows while the server answers", async () => {
  await mountApp({ layout: "rail" })
  const top = page.getByTestId("sidebar-top-row")
  await expect.element(top.getByRole("button", { name: "Settings" })).toBeVisible()
  await expect.element(rail().getByRole("button", { name: "Settings" })).not.toBeInTheDocument()
  await expect.element(page.getByTestId("server-lost")).not.toBeInTheDocument()
})
