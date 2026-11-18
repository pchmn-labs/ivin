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

  await page.getByRole("button", { name: /First/ }).click()
  await page.getByRole("button", { name: /Second/ }).click()
  await expect.element(page.getByTestId("session-header-title")).toHaveTextContent("Second")
  await back.click()
  await expect.element(page.getByTestId("session-header-title")).toHaveTextContent("First")
  await expect.element(forward).toBeEnabled()
  await forward.click()
  await expect.element(page.getByTestId("session-header-title")).toHaveTextContent("Second")
})

test("the project rail badge counts the sessions waiting on the user", async () => {
  const server = await mountApp()
  await vi.waitFor(() => expect(page.getByTestId("project-waiting").query()).toBeNull())
  server.setStatus("s1", "waiting")
  server.setStatus("s2", "waiting")
  await expect.element(page.getByTestId("project-waiting")).toHaveTextContent("2")
})
