import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { makeTestSession, testDateTime } from "../../../packages/ui/src/core/test-session.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { UiContext, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

type Status = ReturnType<UiHost["useSessionListStatus"]>

const mountPanel = async (status: Partial<Status>, withSession: boolean | "tab-only" = false) => {
  const added: Array<{ slot: string; component: ComponentType }> = []
  const ctx = {
    pluginId: "sessions",
    slots: {
      add: (slot: string, component: ComponentType) => void added.push({ slot, component }),
    },
  } as unknown as UiContext
  activate(ctx)
  const Panel = added.find((a) => a.slot === "sidebar.panel")!.component
  const retry = vi.fn()
  const session = makeTestSession({ id: "s1", title: "Fix the export" })
  const host: UiHost = {
    ...testUiHost,
    useProjects: () => ({
      projects: [{ path: "/p", name: "p", lastOpenedAt: testDateTime(0) }],
      selectedPath: "/p",
    }),
    useSessions: () => (withSession === true ? [session] : []),
    useTabs: () => (withSession ? [{ sessionId: "s1", projectPath: "/p" }] : []),
    useSessionListStatus: () => ({ loaded: true, failed: false, retry, ...status }),
  }
  await render(
    <UiHostProvider host={host}>
      <Panel />
    </UiHostProvider>,
  )
  return { retry }
}

test("while the sessions load, the list shows placeholder rows and no empty message", async () => {
  await mountPanel({ loaded: false })
  await expect
    .element(page.getByRole("region", { name: "Sessions" }))
    .toHaveAttribute("aria-busy", "true")
  expect(page.getByText(/No session/).query()).toBeNull()
})

test("sessions that fail to load say so, with Retry", async () => {
  const { retry } = await mountPanel({ loaded: false, failed: true })
  await expect.element(page.getByText("The sessions could not be loaded.")).toBeVisible()
  expect(page.getByText(/No session/).query()).toBeNull()

  await page.getByRole("button", { name: "Retry" }).click()
  expect(retry).toHaveBeenCalledTimes(1)
})

test("a failure after the list loaded keeps its rows under a notice", async () => {
  const { retry } = await mountPanel({ failed: true }, true)
  await expect.element(page.getByText("Sessions may be out of date.")).toBeVisible()
  await expect.element(page.getByText("Fix the export")).toBeVisible()

  await page.getByRole("button", { name: "Retry" }).click()
  expect(retry).toHaveBeenCalledTimes(1)
})

test("tabs that arrive before their sessions show placeholder rows, not an empty panel", async () => {
  await mountPanel({}, "tab-only")
  await expect
    .element(page.getByRole("region", { name: "Sessions" }))
    .toHaveAttribute("aria-busy", "true")
})
