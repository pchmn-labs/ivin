import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionList } from "./session-list.tsx"

const setup = async () => {
  const server = makeFakeServer()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <SessionList projectPath="/p" projectName="p" />
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

test("sessions waiting on the user sit in their own group above the others", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() => expect(server.sessions.size).toBe(2))
  await expect.element(page.getByRole("region", { name: "Needs you" })).not.toBeInTheDocument()

  server.setStatus("session-1", "waiting")
  const needsYou = page.getByRole("region", { name: "Needs you" })
  await expect.element(needsYou).toBeVisible()
  await expect.element(needsYou.getByTestId("session-status")).toHaveTextContent("Waiting for you")
  await expect
    .element(page.getByRole("region", { name: "Sessions" }).getByTestId("session-item"))
    .toHaveLength(1)
})
