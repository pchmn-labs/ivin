import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { activatePlugin } from "../../../packages/ui/src/app/test-plugin-mount.ts"
import { makeTestSession } from "../../../packages/ui/src/core/test-session.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { Session, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const session = (id: string, title: string) => makeTestSession({ id, title })

const mountSection = async (
  sessions: ReadonlyArray<Session>,
  openTabIds: ReadonlyArray<string>,
) => {
  const Section = activatePlugin(activate, "inactive-sessions")("sidebar.section")
  const opened: string[] = []
  const archived: string[] = []
  const archivedAll: string[][] = []
  const host: UiHost = {
    ...testUiHost,
    useSessions: () => sessions,
    useProjects: () => ({ projects: [], selectedPath: "/p" }),
    useTabs: () => openTabIds.map((sessionId) => ({ sessionId, projectPath: "/p" })),
    useOpenTab: () => (sessionId) => void opened.push(sessionId),
    useSessionActions: (session) => ({
      items: [{ label: "Archive", onSelect: () => void archived.push(session.id) }],
      failure: session.title === "Failed" ? "The session was not archived." : null,
    }),
    useAllSessionsActions: (sessions) => ({
      items: [
        { label: "Archive all", onSelect: () => void archivedAll.push(sessions.map((s) => s.id)) },
      ],
    }),
  }
  await render(
    <UiHostProvider host={host}>
      <Section />
    </UiHostProvider>,
  )
  return { opened, archived, archivedAll }
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
  await expect.element(page.getByText("Closed one")).not.toBeInTheDocument()

  await fold().click()

  await expect.element(page.getByText("Closed one")).toBeVisible()
  expect(rowTitles().map((title) => title?.includes("Closed"))).toEqual([true, true])
  expect(page.getByText("Open one").query()).toBeNull()
  expect(page.getByText("Another project's").query()).toBeNull()

  await fold().click()
  await expect.element(page.getByText("Closed one")).not.toBeInTheDocument()
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

test("the heading's menu acts on every inactive session, folded or not", async () => {
  const { archivedAll } = await mountSection(
    [session("s1", "Open one"), session("s2", "Closed one"), session("s3", "Closed two")],
    ["s1"],
  )
  await fold().hover()
  await page.getByRole("button", { name: "Actions for the inactive sessions" }).click()
  await page.getByRole("menuitem", { name: "Archive all" }).click()

  expect(archivedAll).toEqual([["s2", "s3"]])
  await expect.element(page.getByText("Closed one")).not.toBeInTheDocument()
})
