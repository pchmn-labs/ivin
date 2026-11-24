import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TabView } from "./tab-view.tsx"

test("the empty message waits for the tab list to load", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const list = server.holdNextTabList()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <TabView projectPath="/p" />
    </RegistryProvider>,
  )
  await vi.waitFor(() => expect(server.callsOf("tab.list")).toBe(1))
  expect(page.getByText(/No session open/).query()).toBeNull()

  list.release()
  await expect.element(page.getByText(/No session open/)).toBeVisible()
})

test("with no session open, New session starts one and opens its tab", async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <TabView projectPath="/p" />
    </RegistryProvider>,
  )
  await page.getByRole("button", { name: "New session" }).click()
  await vi.waitFor(() => expect(server.callsOf("session.create")).toBe(1))
  await expect.element(page.getByRole("tabpanel")).toBeVisible()
})
