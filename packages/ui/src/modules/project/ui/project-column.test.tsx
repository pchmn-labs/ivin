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
      <ProjectColumn project={project}>{null}</ProjectColumn>
    </RegistryProvider>,
  )
  return server
}

test("New session starts a session, and the head offers no model choice", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() => expect(server.sessions.size).toBe(1))
  expect(page.getByRole("button", { name: /model/i }).query()).toBeNull()
})
