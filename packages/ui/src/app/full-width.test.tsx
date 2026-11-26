import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import type { FakeServer } from "../core/fake-server-client.ts"
import { folder, makeShopServer, mountApp, shopProject, shopWorktree } from "./test-app.tsx"

const project = shopProject
const worktree = shopWorktree

const makeServer = () => {
  const server = makeShopServer()
  server.folders.set(project, folder("src/", "logo.png", "bundle.js", "gone.ts", "README.md"))
  server.folders.set(`${project}/src`, folder("main.ts"))
  server.folders.set(worktree, folder("notes.md"))
  server.files.set(`${project}/README.md`, { kind: "text", text: "# Shop\n" })
  server.files.set(`${project}/src/main.ts`, { kind: "text", text: 'export const shop = "open"\n' })
  server.files.set(`${project}/logo.png`, { kind: "binary" })
  server.files.set(`${project}/bundle.js`, {
    kind: "too_large",
    size: 3 * 1024 * 1024,
    limit: 2 * 1024 * 1024,
  })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = (server: FakeServer) => mountApp(server, { height: 800 })

const showFiles = async () => {
  await page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: "Files" }).click()
}
const item = (name: string) => page.getByRole("treeitem", { name, exact: true })
const card = () => page.getByRole("region", { name: "Open files" })
const code = (name: string) => page.getByRole("textbox", { name })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const rowTab = (name: string) =>
  card().getByRole("tablist", { name: "Open files" }).getByRole("tab", { name, exact: true })
const composer = () => page.getByRole("textbox", { name: "Message" })
const fullWidthButton = () => card().getByRole("button", { name: "Full width" })
const besideButton = () => card().getByRole("button", { name: "Beside chat" })
const toggleKeys = `{${mod}>}{Shift>}{Enter}{/Shift}{/${mod}}`
const nextKeys = `{${mod}>}{Alt>}{ArrowRight}{/Alt}{/${mod}}`
const previousKeys = `{${mod}>}{Alt>}{ArrowLeft}{/Alt}{/${mod}}`

const openTwoFiles = async () => {
  await showFiles()
  await item("README.md").click()
  await item("src").click()
  await item("main.ts").click()
  await expect.element(code("main.ts")).toBeVisible()
}

test("the button covers the main area with the card, which gains a Session tab, and switches back", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  await expect.element(composer()).toBeVisible()
  await expect.element(rowTab("Session")).not.toBeInTheDocument()

  await fullWidthButton().click()
  await expect.element(besideButton()).toBeVisible()
  await expect.element(rowTab("Session")).toHaveAttribute("aria-selected", "false")
  await expect.element(rowTab("main.ts")).toHaveAttribute("aria-selected", "true")
  await expect.element(composer()).not.toBeInTheDocument()
  expect(server.subViews.get("s1")?.fullWidth).toBe(true)

  await besideButton().click()
  await expect.element(fullWidthButton()).toBeVisible()
  await expect.element(rowTab("Session")).not.toBeInTheDocument()
  await userEvent.keyboard(toggleKeys)
  await expect.element(besideButton()).toBeVisible()
  await userEvent.keyboard(toggleKeys)
  await expect.element(composer()).toBeVisible()
  await expect.element(code("main.ts")).toBeVisible()
  expect(server.subViews.get("s1")?.fullWidth).toBe(false)
})

test("in full width, the Session tab shows the chat inside the card, and a file tab shows the file", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  await fullWidthButton().click()

  await rowTab("Session").click()
  await expect.element(composer()).toBeVisible()
  await expect.element(code("main.ts")).not.toBeInTheDocument()
  await expect.element(rowTab("Session")).toHaveAttribute("aria-selected", "true")
  expect(server.subViews.get("s1")?.sessionTabSelected).toBe(true)

  await rowTab("README.md").click()
  await expect.element(code("README.md")).toBeVisible()
  await expect.element(composer()).not.toBeInTheDocument()
  expect(server.subViews.get("s1")?.sessionTabSelected).toBe(false)
})

test("the keybinding switches the mode, and the next and previous tab keybindings go round the row", async () => {
  await mount(makeServer())
  await openTwoFiles()
  await composer().click()

  await userEvent.keyboard(toggleKeys)
  await expect.element(besideButton()).toBeVisible()
  await userEvent.keyboard(nextKeys)
  await expect.element(rowTab("Session")).toHaveAttribute("aria-selected", "true")
  await expect.element(composer()).toBeVisible()
  await userEvent.keyboard(nextKeys)
  await expect.element(rowTab("README.md")).toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard(previousKeys)
  await userEvent.keyboard(previousKeys)
  await expect.element(rowTab("main.ts")).toHaveAttribute("aria-selected", "true")

  await userEvent.keyboard(toggleKeys)
  await expect.element(fullWidthButton()).toBeVisible()
  await userEvent.keyboard(nextKeys)
  await expect.element(rowTab("README.md")).toHaveAttribute("aria-selected", "true")
})

test("the arrow keys move through the Session tab in full width", async () => {
  await mount(makeServer())
  await openTwoFiles()
  await fullWidthButton().click()
  await rowTab("README.md").click()

  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(rowTab("Session")).toHaveAttribute("aria-selected", "true")
  await expect.element(rowTab("Session")).toHaveFocus()
})

test("closing files in full width keeps the mode, and closing the last one leaves the chat alone", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  await fullWidthButton().click()

  await card().getByRole("button", { name: "Close main.ts", includeHidden: true }).click()
  await expect.element(rowTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect.element(besideButton()).toBeVisible()
  await rowTab("Session").click()
  await rowTab("README.md").hover()
  await card().getByRole("button", { name: "Close README.md", includeHidden: true }).click()

  await expect.element(card()).not.toBeInTheDocument()
  await expect.element(composer()).toBeVisible()
})

test("the Close file keybinding does nothing while the Session tab is selected", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  await fullWidthButton().click()
  await rowTab("Session").click()

  await userEvent.keyboard(`{${mod}>}{Shift>}w{/Shift}{/${mod}}`)
  expect(server.callsOf("tab.closeSubView")).toBe(0)
  await expect.element(rowTab("main.ts")).toBeVisible()
})

test("each tab keeps its own mode", async () => {
  await mount(makeServer())
  await openTwoFiles()
  await fullWidthButton().click()

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect.element(composer()).toBeVisible()
  await item("notes.md").click()
  await expect.element(fullWidthButton()).toBeVisible()
  await expect.element(composer()).toBeVisible()

  await sessionTab("Checkout flow").getByRole("tab").click()
  await expect.element(besideButton()).toBeVisible()
  await expect.element(composer()).not.toBeInTheDocument()
})

test("full width and the selected Session tab are back at launch, from the server", async () => {
  const server = makeServer()
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews: [{ view: "files/file", params: { path: "README.md" } }],
    selected: { view: "files/file", params: { path: "README.md" } },
    fullWidth: true,
    sessionTabSelected: true,
  })
  await mount(server)
  await expect.element(rowTab("Session")).toHaveAttribute("aria-selected", "true")
  await expect.element(besideButton()).toBeVisible()
  await expect.element(composer()).toBeVisible()
})

test("a mode switch the server refuses goes back", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  server.failNextCall("tab.setFullWidth")

  await fullWidthButton().click()
  await expect
    .element(card().getByText("This tab could not switch to full width. Retry."))
    .toBeVisible()
  await expect.element(fullWidthButton()).toBeVisible()
  await expect.element(composer()).toBeVisible()

  await card().getByRole("button", { name: "Retry" }).click()
  await expect.element(besideButton()).toBeVisible()
  await expect.element(card().getByText(/could not switch/)).not.toBeInTheDocument()
})

test("the file tab list holds only tabs: its close buttons and separator are hidden from screen readers", async () => {
  const server = makeServer()
  await mount(server)
  await openTwoFiles()
  await fullWidthButton().click()
  await expect.element(rowTab("Session")).toBeVisible()

  const list = card().getByRole("tablist", { name: "Open files" }).element()
  const hidden = list.querySelectorAll(".iv-sub-view-card__close, .iv-sub-view-card__separator")
  expect(hidden).toHaveLength(3)
  for (const element of hidden) {
    expect(element.getAttribute("aria-hidden")).toBe("true")
    if (element.tagName === "BUTTON") expect(element.getAttribute("tabindex")).toBe("-1")
  }
})
