import { RegistryProvider } from "@effect/atom-react"
import { afterEach, expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { ShellControls } from "./shell-controls.tsx"

afterEach(() => vi.unstubAllGlobals())

const mount = () =>
  render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, makeFakeServer().layer]]}>
      <ShellControls projectPath="/p" sidebarOpen onToggleSidebar={() => {}} />
    </RegistryProvider>,
  )

test("a build that is not packaged says so beside the sidebar toggle", async () => {
  vi.stubGlobal("ivin", { devBuild: true })
  await mount()

  await expect.element(page.getByTestId("dev-build")).toHaveTextContent("Dev build")
})

test("a packaged build shows no dev mark", async () => {
  vi.stubGlobal("ivin", { devBuild: false })
  await mount()

  await expect.element(page.getByRole("button", { name: "Toggle sidebar" })).toBeVisible()
  expect(page.getByTestId("dev-build").query()).toBeNull()
})
