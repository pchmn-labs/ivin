import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { makeTestSession, testDateTime } from "../../packages/ui/src/core/test-session.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { Session, SlotProps, UiContext, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const projects = [
  { path: "/shop", name: "shop", lastOpenedAt: testDateTime(0) },
  { path: "/blog", name: "blog", lastOpenedAt: testDateTime(0) },
]

const mountPanel = async (sessions: ReadonlyArray<Session>, onScreen: string | null) => {
  const added: Array<{ slot: string; component: ComponentType<never> }> = []
  const ctx: UiContext = {
    pluginId: "working",
    slots: {
      add: (slot, component) =>
        void added.push({ slot, component: component as ComponentType<never> }),
    },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
  }
  activate(ctx)
  const Panel = added.find((a) => a.slot === "sidebar.section")!.component as ComponentType<
    SlotProps["sidebar.section"]
  >
  const opened: string[] = []
  const host: UiHost = {
    useSession: () => undefined,
    useSessions: () => sessions,
    useProjects: () => ({ projects, selectedPath: "/shop" }),
    useSelectedSessionId: () => onScreen,
    useTabs: () => [],
    useOpenTab: () => (sessionId) => void opened.push(sessionId),
    useTranscript: () => [],
    useAnswerApproval: () => async () => undefined,
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <Panel />
    </UiHostProvider>,
  )
  return { opened }
}

const minutesAgo = (minutes: number) => testDateTime(Date.now() - minutes * 60_000)
const session = (
  id: string,
  title: string,
  projectPath: string,
  status: Session["status"],
  minutes = 0,
) => makeTestSession({ id, title, projectPath, status, statusChangedAt: minutesAgo(minutes) })

const panel = () => page.getByTestId("working-panel")
const group = (label: string) => page.getByRole("region", { name: label })

test("another project's session waiting for an approval shows under Needs you, with its project and elapsed time", async () => {
  await mountPanel(
    [
      session("on-screen", "Fix the cart", "/shop", "working"),
      session("waits", "Write the post", "/blog", "waiting", 12),
      session("runs", "Add search", "/shop", "working", 3),
      session("rests", "Old idea", "/shop", "idle"),
    ],
    "on-screen",
  )

  const needsYou = group("Needs you")
  await expect.element(needsYou.getByText("Write the post")).toBeVisible()
  await expect.element(needsYou.getByText("blog")).toBeVisible()
  await expect.element(needsYou.getByText("12 min")).toBeVisible()
  await expect.element(needsYou.getByText("Waiting for you")).toBeVisible()
  await expect.element(group("Running").getByText("Add search")).toBeVisible()
  expect(page.getByText("Fix the cart").query()).toBeNull()
  expect(page.getByText("Old idea").query()).toBeNull()
})

test("clicking a row opens its session's tab", async () => {
  const { opened } = await mountPanel(
    [session("waits", "Write the post", "/blog", "waiting")],
    null,
  )

  await page.getByText("Write the post").click()

  expect(opened).toEqual(["waits"])
})

test("the panel folds and unfolds its rows", async () => {
  await mountPanel([session("runs", "Add search", "/shop", "working")], null)
  const summary = page.getByText(/^Working ·/)
  await expect.element(page.getByText("Add search")).toBeVisible()

  await summary.click()
  await expect.element(page.getByText("Add search")).not.toBeVisible()
  await summary.click()
  await expect.element(page.getByText("Add search")).toBeVisible()
})

test("the panel is absent when no session outside the one on screen runs or waits", async () => {
  await mountPanel(
    [
      session("on-screen", "Fix the cart", "/shop", "waiting"),
      session("rests", "Idle", "/blog", "idle"),
    ],
    "on-screen",
  )
  expect(panel().query()).toBeNull()
})
