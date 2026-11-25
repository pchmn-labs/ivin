import { DateTime } from "effect"
import { afterEach, beforeEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer, type FakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { folder, mountApp } from "./test-app.tsx"

const project = "/dev/shop"
const readme = `${project}/README.md`

const makeServer = () => {
  const server = makeFakeServer({
    project: { path: project, name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  for (const [id, title] of [
    ["s1", "Checkout flow"],
    ["s2", "Fix the cart"],
  ] as const) {
    server.sessions.set(
      id,
      makeTestSession({ id, title, projectPath: project, workingFolder: project }),
    )
  }
  server.folders.set(project, folder("README.md", "main.ts"))
  server.files.set(readme, { kind: "text", text: "# Shop" })
  server.files.set(`${project}/main.ts`, { kind: "text", text: "export {}" })
  server.subViews.set("s1", {
    sessionId: "s1",
    subViews: [
      { view: "files/file", params: { path: "README.md" } },
      { view: "files/file", params: { path: "main.ts" } },
    ],
    selected: { view: "files/file", params: { path: "README.md" } },
    fullWidth: false,
    sessionTabSelected: false,
  })
  server.openTab("s2")
  server.openTab("s1")
  return server
}

const mount = (server: FakeServer) => mountApp(server, { height: 800 })

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const card = () => page.getByRole("region", { name: "Open files" })
const fileTab = (name: string) =>
  card().getByRole("tablist", { name: "Open files" }).getByRole("tab", { name })
const code = (name: string) => page.getByRole("textbox", { name })
const sessionTab = (title: string) => page.getByTestId("tab").filter({ hasText: title })
const dialog = () => page.getByRole("dialog")
const closeSessionTab = async (title: string) => {
  await sessionTab(title).hover()
  await sessionTab(title)
    .getByRole("button", { name: `Close ${title}`, includeHidden: true })
    .click()
}
const fileOf = (server: FakeServer, path = readme) => {
  const file = server.files.get(path)
  return file !== undefined && file !== "unreadable" && file.kind === "text" ? file.text : null
}

const typeAtEnd = async (name: string, text: string) => {
  await code(name).click()
  await userEvent.keyboard(`{${mod}>}{End}{/${mod}}${text}`)
}
const save = () => userEvent.keyboard(`{${mod}>}s{/${mod}}`)

beforeEach(async () => {
  localStorage.clear()
  await page.viewport(1400, 800)
})
afterEach(() => localStorage.clear())

test("an edited file shows a dot on its tab until Save writes it", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " and more")

  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")
  await expect.element(fileTab("main.ts")).not.toHaveAccessibleDescription("Unsaved edits")
  await save()
  await expect.poll(() => fileOf(server)).toBe("# Shop and more")
  await expect.element(fileTab("README.md")).not.toHaveAccessibleDescription("Unsaved edits")
  await expect.element(code("README.md")).toHaveTextContent("# Shop and more")
})

test("unsaved edits survive a session switch, and are saved afterwards", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await sessionTab("Fix the cart").getByRole("tab").click()
  await expect.element(card()).not.toBeInTheDocument()
  await sessionTab("Checkout flow").getByRole("tab").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop draft")
  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")
  await typeAtEnd("README.md", "!")
  await save()
  await expect.poll(() => fileOf(server)).toBe("# Shop draft!")
})

test("closing an unsaved file asks first; Cancel keeps it, Close without saving drops the edits", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await card().getByRole("button", { name: "Close README.md", includeHidden: true }).click()
  await expect.element(dialog().getByText("Close README.md without saving?")).toBeVisible()
  await dialog().getByRole("button", { name: "Cancel" }).click()
  await expect.element(fileTab("README.md")).toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop draft")

  await card().getByRole("button", { name: "Close README.md", includeHidden: true }).click()
  await dialog().getByRole("button", { name: "Close without saving" }).click()
  await expect.element(fileTab("README.md")).not.toBeInTheDocument()
  expect(fileOf(server)).toBe("# Shop")
  await page.getByRole("tablist", { name: "Sidebar" }).getByRole("tab", { name: "Files" }).click()
  await page.getByRole("treeitem", { name: "README.md", exact: true }).click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(fileTab("README.md")).not.toHaveAccessibleDescription("Unsaved edits")
})

test("Save in the close prompt writes the file, then closes it", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await userEvent.keyboard(`{${mod}>}{Shift>}w{/Shift}{/${mod}}`)
  await dialog().getByRole("button", { name: "Save", exact: true }).click()
  await expect.element(fileTab("README.md")).not.toBeInTheDocument()
  expect(fileOf(server)).toBe("# Shop draft")
})

test("a Save in the close prompt that fails keeps the file open and shows it with its failure", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")
  await fileTab("main.ts").click()
  server.unwritable = true

  await card().getByRole("button", { name: "Close README.md", includeHidden: true }).click()
  await dialog().getByRole("button", { name: "Save", exact: true }).click()
  await expect.element(fileTab("README.md")).toHaveAttribute("aria-selected", "true")
  await expect
    .element(card().getByText(/^README\.md was not saved\. Check its permissions/))
    .toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop draft")
})

test("closing a session's tab with unsaved files asks first", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await closeSessionTab("Checkout flow")
  await expect
    .element(dialog().getByText("Close “Checkout flow” without saving its files?"))
    .toBeVisible()
  await expect.element(dialog().getByText(/README\.md has unsaved edits/)).toBeVisible()
  await dialog().getByRole("button", { name: "Cancel" }).click()
  await expect.element(sessionTab("Checkout flow")).toBeVisible()

  await closeSessionTab("Checkout flow")
  await dialog().getByRole("button", { name: "Close without saving" }).click()
  await expect.element(sessionTab("Checkout flow")).not.toBeInTheDocument()
  expect(fileOf(server)).toBe("# Shop")
})

test("a save refused because the file changed on disk warns, Overwrite writes the edits and Reload from disk drops them", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " mine")
  server.files.set(readme, { kind: "text", text: "# Agent's" })

  await save()
  const warning = card().getByRole("alert")
  await expect
    .element(warning.getByText("README.md changed on disk while you had unsaved edits."))
    .toBeVisible()
  expect(fileOf(server)).toBe("# Agent's")
  await save()
  expect(fileOf(server)).toBe("# Agent's")

  await warning.getByRole("button", { name: "Overwrite" }).click()
  await expect.poll(() => fileOf(server)).toBe("# Shop mine")
  await expect.element(warning).not.toBeInTheDocument()
  await expect.element(fileTab("README.md")).not.toHaveAccessibleDescription("Unsaved edits")

  await typeAtEnd("README.md", " again")
  server.files.set(readme, { kind: "text", text: "# Agent's" })
  await save()
  await warning.getByRole("button", { name: "Reload from disk" }).click()
  await expect.element(code("README.md")).toHaveTextContent("# Agent's")
  await expect.element(warning).not.toBeInTheDocument()
  await expect.element(fileTab("README.md")).not.toHaveAccessibleDescription("Unsaved edits")
})
test("a file that changed on disk under unsaved edits warns as soon as it is shown again", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " mine")
  await sessionTab("Fix the cart").getByRole("tab").click()
  server.files.set(readme, { kind: "text", text: "# Agent's" })
  await sessionTab("Checkout flow").getByRole("tab").click()

  await expect
    .element(
      card().getByRole("alert").getByText("README.md changed on disk while you had unsaved edits."),
    )
    .toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop mine")
})

test("a file deleted on disk under unsaved edits keeps them, and Overwrite writes it again", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " mine")
  await sessionTab("Fix the cart").getByRole("tab").click()
  server.files.delete(readme)
  await sessionTab("Checkout flow").getByRole("tab").click()

  const warning = card().getByRole("alert")
  await expect
    .element(warning.getByText("README.md was deleted on disk while you had unsaved edits."))
    .toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop mine")
  await warning.getByRole("button", { name: "Overwrite" }).click()
  await expect.poll(() => fileOf(server)).toBe("# Shop mine")
})

test("a failed save says so next to the file and keeps the edits; Retry saves them, and a save cut off from the server says so too", async () => {
  const server = makeServer()
  server.unwritable = true
  await mount(server)
  await typeAtEnd("README.md", " mine")
  await save()

  await expect
    .element(
      card().getByText(
        "README.md was not saved. Check its permissions, then retry. Your edits are kept.",
      ),
    )
    .toBeVisible()
  await expect.element(code("README.md")).toHaveTextContent("# Shop mine")
  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")

  server.unwritable = false
  await card().getByRole("button", { name: "Retry" }).click()
  await expect.poll(() => fileOf(server)).toBe("# Shop mine")
  await expect.element(card().getByRole("button", { name: "Retry" })).not.toBeInTheDocument()

  await typeAtEnd("README.md", " more")
  server.failNextCall("file.writeFile")
  await save()
  await expect
    .element(card().getByText("README.md was not saved. Retry. Your edits are kept."))
    .toBeVisible()
  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")
})
test("archiving a session with unsaved files asks first; Cancel keeps the session and its edits", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await userEvent.keyboard(`{Shift>}{${mod}>}{Backspace}{/${mod}}{/Shift}`)
  await expect.element(dialog().getByText("Archive “Checkout flow”?")).toBeVisible()
  await expect
    .element(
      dialog().getByText("Archiving this session will lose the unsaved edits to these files:"),
    )
    .toBeVisible()
  await expect.element(dialog().getByText("README.md", { exact: true })).toBeVisible()
  await expect.element(dialog().getByRole("button", { name: "Cancel" })).toHaveFocus()
  await dialog().getByRole("button", { name: "Cancel" }).click()

  await expect.element(sessionTab("Checkout flow")).toBeVisible()
  expect(server.sessions.get("s1")?.archivedAt).toBeNull()
  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")
})

test("confirming an archive from the tab's menu drops the edits, and a restore does not bring them back", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await sessionTab("Checkout flow").click({ button: "right" })
  await page.getByRole("menuitem", { name: "Archive" }).click()
  await dialog().getByRole("button", { name: "Archive and lose edits" }).click()
  await expect.element(sessionTab("Checkout flow")).not.toBeInTheDocument()
  await expect.poll(() => server.sessions.get("s1")?.archivedAt).not.toBeNull()

  await userEvent.keyboard(`{Shift>}{${mod}>}a{/${mod}}{/Shift}`)
  await userEvent.keyboard("{Enter}")
  await expect.poll(() => server.sessions.get("s1")?.archivedAt).toBeNull()
  await userEvent.keyboard("{Escape}")
  await page.getByText(/^Inactive sessions/).click()
  await page.getByTestId("inactive-sessions").getByText("Checkout flow").click()
  await expect.element(code("README.md")).toHaveTextContent("# Shop")
  await expect.element(fileTab("README.md")).not.toHaveAccessibleDescription("Unsaved edits")
})

test("deleting a session with unsaved files lists them in the one dialog", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  const row = page.getByTestId("session-item").filter({ hasText: "Checkout flow" })
  await row.hover()
  await row.getByRole("button", { name: "Session actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  await expect.element(dialog().getByText("Delete “Checkout flow”?")).toBeVisible()
  await expect
    .element(
      dialog().getByText("Deleting this session will lose the unsaved edits to these files:"),
    )
    .toBeVisible()
  await expect.element(dialog().getByText("README.md", { exact: true })).toBeVisible()
  await dialog().getByRole("button", { name: "Delete and lose edits" }).click()
  await expect.poll(() => server.sessions.has("s1")).toBe(false)
})

test("closing a project with unsaved files asks first; Cancel keeps them, confirming closes it", async () => {
  const server = makeServer()
  await mount(server)
  await typeAtEnd("README.md", " draft")

  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Close project" }).click()
  await expect.element(dialog().getByText("Close “shop”?")).toBeVisible()
  await dialog().getByRole("button", { name: "Cancel" }).click()
  await expect.element(fileTab("README.md")).toHaveAccessibleDescription("Unsaved edits")

  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Close project" }).click()
  await dialog().getByRole("button", { name: "Close project and lose edits" }).click()
  await expect.element(page.getByTestId("project-name")).not.toBeInTheDocument()
})
