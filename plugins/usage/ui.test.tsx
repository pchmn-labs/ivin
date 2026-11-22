import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { SlotProps, TranscriptItem, UiContext } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const usage = (
  position: number,
  inputTokens: number,
  outputTokens: number,
  costUsd: number | null,
) =>
  ({
    id: `u${position}`,
    sessionId: "s1",
    position,
    at: 0,
    type: "usage",
    inputTokens,
    outputTokens,
    costUsd,
  }) satisfies TranscriptItem

const mountStatus = async (items: ReadonlyArray<TranscriptItem>) => {
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
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Status = added.find((a) => a.slot === "composer.status")!.component as ComponentType<
    SlotProps["composer.status"]
  >
  const host = {
    useSession: () => undefined,
    useSessions: () => [],
    useProjects: () => ({ projects: [], selectedPath: null }),
    useSelectedSessionId: () => null,
    useTabs: () => [],
    useOpenTab: () => () => {},
    useTranscript: () => items,
    useAnnotations: () => [],
    useAnswerApproval: () => async () => undefined,
    useListFolder: () => async () => ({ kind: "listed" as const, entries: [] }),
    useOpenFile: () => async () => undefined,
    useSessionActions: () => ({ items: [], failure: null }),
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <Status sessionId="s1" />
    </UiHostProvider>,
  )
}

test("the status line shows the session's total tokens and cost", async () => {
  await mountStatus([usage(0, 1000, 200, 0.01), usage(1, 300, 40, 0.0023)])
  await expect.element(page.getByText("1,540 tokens · $0.0123")).toBeVisible()
})

test("the status line is empty without usage", async () => {
  await mountStatus([])
  expect(document.querySelector('[data-testid="usage-status"]')).toBeNull()
})
