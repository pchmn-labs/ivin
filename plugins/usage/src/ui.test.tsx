import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { SessionUsage, SlotProps, UiContext } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const mountStatus = async (total: SessionUsage) => {
  const added: Array<{ slot: string; component: ComponentType<never> }> = []
  const ctx: UiContext = {
    pluginId: "usage",
    slots: {
      add: (slot, component) =>
        void added.push({ slot, component: component as ComponentType<never> }),
    },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    views: { register: () => undefined, open: async () => undefined },
    notify: () => undefined,
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Status = added.find((a) => a.slot === "composer.status")!.component as ComponentType<
    SlotProps["composer.status"]
  >
  const host = {
    ...testUiHost,
    useUsage: () => total,
  }
  await render(
    <UiHostProvider host={host}>
      <Status sessionId="s1" />
    </UiHostProvider>,
  )
}

test("the status line shows the session's total tokens and cost, as the server sums them", async () => {
  await mountStatus({ tokens: 1540, costUsd: 0.0123 })
  await expect.element(page.getByText("1,540 tokens · $0.0123")).toBeVisible()
})

test("the status line is empty without usage", async () => {
  await mountStatus(null)
  expect(document.querySelector('[data-testid="usage-status"]')).toBeNull()
})
