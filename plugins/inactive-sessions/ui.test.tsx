import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { makeTestSession } from "../../packages/ui/src/core/test-session.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { Session, SlotProps, UiContext, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const session = (id: string, title: string) => makeTestSession({ id, title })

const mountSection = async (
  sessions: ReadonlyArray<Session>,
  openTabIds: ReadonlyArray<string>,
) => {
  const added: Array<{ slot: string; component: ComponentType<never> }> = []
  const ctx: UiContext = {
    pluginId: "inactive-sessions",
    slots: {
      add: (slot, component) =>
        void added.push({ slot, component: component as ComponentType<never> }),
    },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
  }
  activate(ctx)
  const Section = added.find((a) => a.slot === "sidebar.section")!.component as ComponentType<
    SlotProps["sidebar.section"]
  >
  const opened: string[] = []
  const host: UiHost = {
    useSession: () => undefined,
    useSessions: () => sessions,
    useProjects: () => ({ projects: [], selectedPath: "/p" }),
    useSelectedSessionId: () => null,
    useTabs: () => openTabIds.map((sessionId) => ({ sessionId, projectPath: "/p" })),
    useOpenTab: () => (sessionId) => void opened.push(sessionId),
    useTranscript: () => [],
    useAnswerApproval: () => async () => undefined,
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <Section />
    </UiHostProvider>,
  )
  return { opened }
}

const fold = () => page.getByText(/^Inactive sessions/)
const rowTitles = () =>
  Array.from(document.querySelectorAll('[data-testid="inactive-session"]')).map(
    (row) => row.textContent,
  )

test("the section lists exactly the selected project's sessions without a tab, folded until opened", async () => {
  await mountSection(
    [
      session("s1", "Open one"),
      session("s2", "Closed one"),
      session("s3", "Closed two"),
      makeTestSession({ id: "s4", title: "Another project's", projectPath: "/other" }),
    ],
    ["s1"],
  )
  await expect.element(fold()).toBeVisible()
  await expect.element(page.getByText("2", { exact: true })).toBeVisible()
  await expect.element(page.getByText("Closed one")).not.toBeVisible()

  await fold().click()

  await expect.element(page.getByText("Closed one")).toBeVisible()
  expect(rowTitles().map((title) => title?.includes("Closed"))).toEqual([true, true])
  expect(page.getByText("Open one").query()).toBeNull()
  expect(page.getByText("Another project's").query()).toBeNull()

  await fold().click()
  await expect.element(page.getByText("Closed one")).not.toBeVisible()
})

test("clicking an inactive session opens its tab", async () => {
  const { opened } = await mountSection([session("s1", "Closed one")], [])
  await fold().click()
  await page.getByText("Closed one").click()

  expect(opened).toEqual(["s1"])
})

test("the section is absent when every session has a tab", async () => {
  await mountSection([session("s1", "Open one")], ["s1"])
  expect(fold().query()).toBeNull()
})
