import { RegistryProvider } from "@effect/atom-react"
import { afterEach, expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { useStartupNoticeBridge } from "../hooks/use-startup-notice-bridge.ts"
import { StartupNotice } from "./startup-notice.tsx"

afterEach(() => Reflect.deleteProperty(window, "ivin"))

function Window() {
  useStartupNoticeBridge()
  return <StartupNotice />
}

const mount = (notice: unknown) => {
  Object.assign(window, { ivin: { getStartupNotice: () => Promise.resolve(notice) } })
  return render(
    <RegistryProvider>
      <Window />
    </RegistryProvider>,
  )
}

test("the notice the desktop app holds shows once at the top, until the user dismisses it", async () => {
  await mount({ _tag: "reloadedWithout", plugins: ["pr-checks", "notes"] })
  await expect.element(page.getByText(/without pr-checks, notes/)).toBeVisible()

  await page.getByRole("button", { name: "Dismiss" }).click()

  await expect.element(page.getByText(/without pr-checks, notes/)).not.toBeInTheDocument()
})

test("a window that started as usual shows no notice", async () => {
  await mount(null)
  await expect.element(page.getByRole("status")).not.toBeInTheDocument()
})
