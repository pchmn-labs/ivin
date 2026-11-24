import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { NoProject } from "./no-project.tsx"

const mount = (server: ReturnType<typeof makeFakeServer>) =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <NoProject />
    </RegistryProvider>,
  )

test("with no project open, it offers to open a folder", async () => {
  await mount(makeFakeServer())
  await expect.element(page.getByText("No project open")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Open folder…" })).toBeVisible()
})

test("projects that cannot load say so with Retry, and Retry loads them", async () => {
  const server = makeFakeServer()
  server.failCalls("project.list")
  await mount(server)
  await expect.element(page.getByText("The projects could not be loaded.")).toBeVisible()

  server.recoverCalls("project.list")
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("No project open")).toBeVisible()
  expect(page.getByText("The projects could not be loaded.").query()).toBeNull()
})
