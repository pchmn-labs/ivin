import { defaultSettings } from "../../../packages/contracts/src/setting.ts"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../../packages/ui/src/app/host-components.ts"
import { testUiHost } from "../../../packages/ui/src/core/test-ui-host.ts"
import { makeTestSession } from "../../../packages/ui/src/core/test-session.ts"
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
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Section = added.find((a) => a.slot === "sidebar.section")!.component as ComponentType<
    SlotProps["sidebar.section"]
  >
  const opened: string[] = []
  const archived: string[] = []
  const host: UiHost = {
    ...testUiHost,
    useSession: () => undefined,
    useSessions: () => sessions,
    useProjects: () => ({ projects: [], selectedPath: "/p" }),
    useSelectedSessionId: () => null,
    useTabs: () => openTabIds.map((sessionId) => ({ sessionId, projectPath: "/p" })),
    useOpenTab: () => (sessionId) => void opened.push(sessionId),
    useTranscript: () => [],
    useAnnotations: () => [],
    useAnswerApproval: () => async () => undefined,
    useAnswerQuestion: () => async () => undefined,
    useListFolder: () => async () => ({ kind: "listed" as const, entries: [] }),
    useOpenFile: () => async () => undefined,
    useListFiles: () => async () => ({ kind: "listed" as const, paths: [], truncated: false }),
    useFolderChanges: () => undefined,
    useGitStatus: () => [],
    useFileOnScreen: () => null,
    useChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenDiff: () => async () => undefined,
    useDiffOnScreen: () => null,
    useSettings: () => defaultSettings,
    useCommittedChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenCommittedDiff: () => async () => undefined,
    useCommittedDiffOnScreen: () => null,
    useDiscardChanges: () => async () => undefined,
    useSessionActions: (session) => ({
      items: [{ label: "Archive", onSelect: () => void archived.push(session.id) }],
      failure: session.title === "Failed" ? "The session was not archived." : null,
    }),
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <Section />
    </UiHostProvider>,
  )
  return { opened, archived }
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

test("an inactive session's menu archives it, and a failure shows under its row", async () => {
  const { archived } = await mountSection([session("s1", "Closed"), session("s2", "Failed")], [])
  await fold().click()

  await page.getByText("Closed").hover()
  await page.getByRole("button", { name: "Actions for Closed" }).click()
  await page.getByRole("menuitem", { name: "Archive" }).click()

  expect(archived).toEqual(["s1"])
  await expect.element(page.getByRole("alert")).toHaveTextContent("The session was not archived.")
})
