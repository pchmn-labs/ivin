import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mountApp = async () => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  for (const [id, title] of [
    ["s1", "First"],
    ["s2", "Second"],
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

  await userEvent.keyboard("{Control>}\\{/Control}")
  await expect.element(page.getByRole("complementary")).toBeVisible()
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

test("the project row badge counts the sessions waiting on the user", async () => {
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
  await expect.element(page.getByText(/No session open/)).toBeVisible()
})

test("picking another project shows its own tabs, and closing a project drops it", async () => {
  const server = await mountApp()
  server.openProject("/dev/other")
  await page
    .getByTestId("project-item")
    .filter({ hasText: "ivin" })
    .getByRole("button")
    .first()
    .click()
  await expect.element(page.getByRole("tab")).toHaveLength(2)

  await page.getByRole("button", { name: "Close ivin" }).click()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("other")
  await expect.element(page.getByText(/No session open/)).toBeVisible()
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
