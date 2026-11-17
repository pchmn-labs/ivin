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
      <SessionList projectPath="/p" />
    </RegistryProvider>,
  )
  return server
}

test("a new session uses sonnet unless another model is picked", async () => {
  const server = await setup()
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() =>
    expect([...server.sessions.values()].map((s) => s.model)).toEqual(["sonnet"]),
  )

  await page.getByRole("combobox", { name: "Model" }).selectOptions("opus")
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() =>
    expect([...server.sessions.values()].map((s) => s.model)).toEqual(["sonnet", "opus"]),
  )
})
