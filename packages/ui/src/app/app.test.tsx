import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mac = navigator.platform.includes("Mac")
const mod = mac ? "Meta" : "Control"

const mountApp = async (
  titles: readonly [string, string] = ["First", "Second"],
  options: { otherProject?: boolean } = {},
) => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  for (const [id, title] of [
    ["s1", titles[0]],
    ["s2", titles[1]],
  ] as const) {
    server.sessions.set(id, {
      id,
      projectPath: "/dev/ivin",
      title,
      model: "sonnet",
      status: "idle",
      createdAt: at,
      lastActivityAt: at,
    })
  }
  server.openTab("s1")
  server.openTab("s2")
  if (options.otherProject) {
    server.openProject("/dev/other")
    server.openProject("/dev/ivin")
  }
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <App />
    </RegistryProvider>,
  )
  return server
}

test("the sidebar card holds the project and its sessions, and the toggle hides it", async () => {
  await mountApp()
  await expect.element(page.getByRole("complementary")).toBeVisible()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")

  await page.getByRole("button", { name: "Toggle sidebar" }).click()
  await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible()

  await userEvent.keyboard(`{${mod}>}\\{/${mod}}`)
  await expect.element(page.getByRole("complementary")).toBeVisible()
})

test("the sidebar toggle shows its key in its tooltip", async () => {
  await mountApp()
  await page.getByRole("button", { name: "Toggle sidebar" }).hover()
  await expect
    .element(page.getByText(mac ? "Toggle sidebar (⌘\\)" : "Toggle sidebar (Ctrl+\\)"))
    .toBeVisible()
})

test("keybindings.json moves the sidebar toggle to mod+b while the app runs", async () => {
  const server = await mountApp()
  await expect.element(page.getByRole("complementary")).toBeVisible()
  server.setUserKeybindings({
    keybindings: [
      { key: "mod+b", command: "sidebar.toggle", when: null },
      { key: "mod+\\", command: "-sidebar.toggle", when: null },
    ],
    problem: null,
  })
  await page.getByRole("button", { name: "Toggle sidebar" }).hover()
  await expect
    .element(page.getByText(mac ? "Toggle sidebar (⌘B)" : "Toggle sidebar (Ctrl+B)"))
    .toBeVisible()

  await userEvent.keyboard(`{${mod}>}\\{/${mod}}`)
  await new Promise((resolve) => setTimeout(resolve, 100))
  await expect.element(page.getByRole("complementary")).toBeVisible()
  await userEvent.keyboard(`{${mod}>}b{/${mod}}`)
  await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()
})

test("an invalid keybindings.json is reported and keeps the previous keybindings", async () => {
  const server = await mountApp()
  const moved = [
    { key: "mod+b", command: "sidebar.toggle", when: null },
    { key: "mod+\\", command: "-sidebar.toggle", when: null },
  ]
  server.setUserKeybindings({ keybindings: moved, problem: null })
  server.setUserKeybindings({ keybindings: moved, problem: { reason: "notJson", entry: null } })
  await expect
    .element(page.getByRole("alert").getByText(/keybindings\.json is not valid JSON\./))
    .toBeVisible()

  await userEvent.keyboard(`{${mod}>}b{/${mod}}`)
  await expect.element(page.getByRole("complementary")).not.toBeInTheDocument()

  server.setUserKeybindings({ keybindings: [], problem: null })
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})

test("back and forward walk the sessions opened in this window", async () => {
  await mountApp()
  const back = page.getByRole("button", { name: "Back" })
  const forward = page.getByRole("button", { name: "Forward" })
  await expect.element(back).toBeDisabled()

  await page
    .getByTestId("session-item")
    .filter({ hasText: "First" })
    .getByRole("button")
    .first()
    .click()
  await page
    .getByTestId("session-item")
    .filter({ hasText: "Second" })
    .getByRole("button")
    .first()
    .click()
  await expect
    .element(page.getByRole("tab", { name: /Second/ }))
    .toHaveAttribute("aria-selected", "true")
  await back.click()
  await expect
    .element(page.getByRole("tab", { name: /First/ }))
    .toHaveAttribute("aria-selected", "true")
  await expect.element(forward).toBeEnabled()
  await forward.click()
  await expect
    .element(page.getByRole("tab", { name: /Second/ }))
    .toHaveAttribute("aria-selected", "true")
})

test("the project button badge counts the sessions waiting on the user", async () => {
  const server = await mountApp()
  await vi.waitFor(() => expect(page.getByTestId("project-waiting").query()).toBeNull())
  server.setStatus("s1", "waiting")
  server.setStatus("s2", "waiting")
  await expect.element(page.getByTestId("project-waiting")).toHaveTextContent("2")
})

test("each tab shows its session, closes on its button, and the bar reorders by drag", async () => {
  const server = await mountApp()
  const tabs = page.getByRole("tab")
  await expect.element(tabs).toHaveLength(2)
  await expect
    .element(page.getByRole("tab", { name: /Second/ }))
    .toHaveAttribute("aria-selected", "true")

  const items = document.querySelectorAll<HTMLElement>('[data-testid="tab"]')
  const dataTransfer = new DataTransfer()
  const fire = (target: HTMLElement, type: string, clientX = 0) =>
    target.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, clientX }),
    )
  const rendered = () => new Promise((resolve) => setTimeout(resolve, 50))
  fire(items[1]!, "dragstart")
  await rendered()
  fire(items[0]!, "dragover", items[0]!.getBoundingClientRect().left + 1)
  await rendered()
  fire(items[0]!, "drop")
  await vi.waitFor(() => expect(server.tabOrder("/dev/ivin")).toEqual(["s2", "s1"]))

  await page.getByRole("tab", { name: /Second/ }).hover()
  await page.getByRole("button", { name: "Close Second" }).click()
  await expect.element(tabs).toHaveLength(1)
  await page.getByRole("tab", { name: /First/ }).hover()
  await page.getByRole("button", { name: "Close First" }).click()
  await expect.element(page.getByRole("main").getByText(/No session open/)).toBeVisible()
})

test("picking another project shows its own tabs, and closing a project drops it", async () => {
  await mountApp(["First", "Second"], { otherProject: true })
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  await page.getByRole("button", { name: "other" }).click()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("other")
  await expect.element(page.getByRole("main").getByText(/No session open/)).toBeVisible()
  await page.getByRole("button", { name: "ivin" }).click()
  await expect.element(page.getByRole("tab")).toHaveLength(2)

  await expect
    .element(page.getByRole("button", { name: "ivin" }))
    .toHaveAttribute("aria-current", "true")
  await page.getByRole("button", { name: "Project actions" }).click()
  await page.getByRole("menuitem", { name: "Close project" }).click()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("other")
  await expect.element(page.getByRole("main").getByText(/No session open/)).toBeVisible()
})

test("the plus after the tabs starts a session with the chosen model, and arrow keys walk the tabs", async () => {
  const server = await mountApp()
  await page.getByRole("button", { name: "Model for the next session" }).click()
  await page.getByRole("menuitem", { name: "opus" }).click()
  await vi.waitFor(() => expect(server.sessions.size).toBe(3))

  await page.getByRole("tablist").getByRole("tab").first().click()
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard("{ArrowLeft}")
  await expect.element(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true")

  await page.getByRole("main").getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() => expect(server.sessions.size).toBe(4))
  expect([...server.sessions.values()].at(-1)?.model).toBe("opus")
  await expect.element(page.getByRole("tab")).toHaveLength(4)
})

test("every tab has the same width, which hovering a tab does not change", async () => {
  await page.viewport(1400, 800)
  await mountApp(["Crée un fichier", "Lance la commande echo bonjour avec Bash"])
  await expect.element(page.getByRole("tab")).toHaveLength(2)
  const widths = () =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="tab"]')].map(
      (tab) => tab.getBoundingClientRect().width,
    )
  const before = widths()
  expect(before[0]).toBe(before[1])

  await page.getByRole("tab", { name: /Crée/ }).hover()
  await expect.element(page.getByRole("button", { name: "Close Crée un fichier" })).toBeVisible()

  expect(widths()).toEqual(before)
})

test("tabs shrink together when the bar runs out of room, down to a minimum", async () => {
  await page.viewport(1400, 800)
  await mountApp(["Crée un fichier", "Lance la commande echo bonjour avec Bash"])
  await expect.element(page.getByRole("tab")).toHaveLength(2)
  const width = () =>
    document.querySelector<HTMLElement>('[data-testid="tab"]')!.getBoundingClientRect().width
  const roomy = width()

  await page.viewport(780, 800)
  await vi.waitFor(() => expect(width()).toBeLessThan(roomy))
  const narrow = width()

  await page.viewport(300, 800)
  await vi.waitFor(() => expect(width()).toBeLessThan(narrow))
  expect(width()).toBe(180)
})

test("a middle click on a tab closes it without selecting it", async () => {
  await page.viewport(1400, 800)
  const server = await mountApp()
  await expect.element(page.getByRole("tab")).toHaveLength(2)

  await page.getByRole("tab", { name: /First/ }).click({ button: "middle" })

  await expect.element(page.getByRole("tab")).toHaveLength(1)
  await vi.waitFor(() => expect(server.tabOrder("/dev/ivin")).toEqual(["s2"]))
  await expect
    .element(page.getByRole("tab", { name: /Second/ }))
    .toHaveAttribute("aria-selected", "true")
})

test("a key keybindings.json gives that ivin cannot read is reported", async () => {
  const server = await mountApp()
  server.setUserKeybindings({
    keybindings: [{ key: "hyper+b", command: "sidebar.toggle", when: null }],
    problem: null,
  })
  await expect
    .element(
      page.getByRole("alert").getByText(/keys ivin cannot read, which do nothing: "hyper\+b"/),
    )
    .toBeVisible()
})
