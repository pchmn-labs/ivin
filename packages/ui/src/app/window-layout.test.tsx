import { DateTime } from "effect"
import { afterEach, expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { mountApp } from "./test-app.tsx"

afterEach(() => {
  Reflect.deleteProperty(window, "ivin")
  localStorage.removeItem("ivin.window.layout")
})

const windowLayout = () => document.querySelector<HTMLElement>(".iv-app")?.dataset.windowLayout

test("choosing One plane in Settings changes the window at once and moves the traffic lights", async () => {
  const told: Array<string> = []
  Object.assign(window, { ivin: { setWindowLayout: (layout: string) => told.push(layout) } })
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  await mountApp(server)
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  expect(windowLayout()).toBe("panels")
  expect(told.at(-1)).toBe("panels")

  await page.getByRole("button", { name: "Settings" }).click()
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Window" })
    .click()
  await page.getByRole("combobox", { name: "Layout" }).selectOptions("plane")
  await page.getByRole("button", { name: "Back to sessions" }).click()

  await vi.waitFor(() => expect(windowLayout()).toBe("plane"))
  expect(told.at(-1)).toBe("plane")
})
