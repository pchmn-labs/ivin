import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { ProjectColumn } from "./project-column.tsx"

const setup = async () => {
  const project = { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) }
  const server = makeFakeServer({ project })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <ProjectColumn project={project} />
    </RegistryProvider>,
  )
  return server
}

test("the head names the project", async () => {
  await setup()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("p")
})

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
