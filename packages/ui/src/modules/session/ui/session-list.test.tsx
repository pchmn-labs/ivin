import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionList } from "./session-list.tsx"

const setup = async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <SessionList projectPath="/p" />
    </RegistryProvider>,
  )
  return server
}

test("a new session uses sonnet until another model is picked, then keeps it", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() =>
    expect([...server.sessions.values()].map((s) => s.model)).toEqual(["sonnet"]),
  )

  await page.getByRole("button", { name: "Model for the next session" }).click()
  await page.getByRole("menuitem", { name: "opus" }).click()
  await vi.waitFor(() =>
    expect([...server.sessions.values()].map((s) => s.model)).toEqual(["sonnet", "opus"]),
  )

  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() =>
    expect([...server.sessions.values()].map((s) => s.model)).toEqual(["sonnet", "opus", "opus"]),
  )
})

test("each row shows the session status and follows the server", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Idle")

  server.setStatus("session-1", "working")
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Working")
  server.setStatus("session-1", "failed")
  await expect.element(page.getByTestId("session-status")).toHaveTextContent("Failed")
})

test("only sessions with an open tab are listed, and picking one selects its tab", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await page.getByRole("button", { name: "New session" }).click()
  await expect.element(page.getByTestId("session-item")).toHaveLength(2)

  await page.getByTestId("session-item").first().getByRole("button").first().click()
  await vi.waitFor(() => expect(server.tabOrder("/p")).toEqual(["session-1", "session-2"]))
  await expect
    .element(page.getByTestId("session-item").first().getByRole("button").first())
    .toHaveAttribute("aria-current", "true")
})
