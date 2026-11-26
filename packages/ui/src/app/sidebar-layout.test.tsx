import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { mountApp as mountServer } from "./test-app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const rail = () => page.getByRole("navigation", { name: "Projects" })
const strip = () => page.getByRole("group", { name: "Projects" })
const projectName = () => page.getByTestId("project-name")
const layout = (value: "rail" | "strip") => ({
  settings: { ...defaultSettings, sidebar: { layout: value } },
  problem: null,
})

const mountApp = async (options: { layout?: "rail" | "strip"; failVersion?: boolean } = {}) => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Other work",
      projectPath: "/dev/other",
      workingFolder: "/dev/other",
    }),
  )
  server.openProject("/dev/other")
  server.openTab("s1")
  server.openProject("/dev/ivin")
  if (options.layout !== undefined) server.setUserSettings(layout(options.layout))
  if (options.failVersion === true) server.failNextCall("server.getVersion")
  await page.viewport(1280, 800)
  await mountServer(server)
  await expect.element(projectName()).toHaveTextContent("ivin")
  return server
}

test("choosing Rail in Settings lists the projects beside the sessions, and the file brings the strip back", async () => {
  const server = await mountApp()
  await expect.element(strip()).toBeVisible()
  await expect.element(page.getByRole("button", { name: /switch project/ })).toBeVisible()

  await page.getByRole("button", { name: "Settings" }).click()
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Sidebar" })
    .click()
  await page.getByRole("combobox", { name: "Projects" }).selectOptions("rail")
  await page.getByRole("button", { name: "Back to sessions" }).click()

  await expect.element(rail()).toBeVisible()
  await expect.element(strip()).not.toBeInTheDocument()

  server.setUserSettings(layout("strip"))
  await expect.element(strip()).toBeVisible()
  await expect.element(rail()).not.toBeInTheDocument()
})

test("in the strip, a project's button, the project menu and the keys select a project", async () => {
  await mountApp({ layout: "strip" })
  await strip().getByRole("button", { name: "other", exact: true }).click()
  await expect.element(projectName()).toHaveTextContent("other")

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
