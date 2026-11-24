import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { makeTestSession, testDateTime } from "../../../packages/ui/src/core/test-session.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type {
  ApprovalItem,
  QuestionItem,
  Session,
  SlotProps,
  TranscriptItem,
  UiContext,
  UiHost,
} from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const projects = [
  { path: "/shop", name: "shop", lastOpenedAt: testDateTime(0) },
  { path: "/blog", name: "blog", lastOpenedAt: testDateTime(0) },
]

const approval = (sessionId: string, command: string): TranscriptItem => ({
  id: `${sessionId}-approval`,
  sessionId,
  position: 1,
  at: 0,
  type: "approval",
  requestId: `${sessionId}-request`,
  toolCallId: null,
  name: "Bash",
  input: { command },
  decision: null,
})

const mountPanel = async (
  sessions: ReadonlyArray<Session>,
  onScreen: string | null,
  {
    transcripts = {},
    answerFails = false,
  }: {
    transcripts?: Record<string, ReadonlyArray<TranscriptItem>>
    answerFails?: boolean
  } = {},
) => {
  const added: Array<{ slot: string; component: ComponentType<never> }> = []
  const ctx: UiContext = {
    pluginId: "working",
    slots: {
      add: (slot, component) =>
        void added.push({ slot, component: component as ComponentType<never> }),
    },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    notify: () => undefined,
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Panel = added.find((a) => a.slot === "sidebar.bottom")!.component as ComponentType<
    SlotProps["sidebar.bottom"]
  >
  const opened: string[] = []
  const answers: Array<{ sessionId: string; requestId: string; allow: boolean }> = []
  const host: UiHost = {
    ...testUiHost,
    useSessions: () => sessions,
    useProjects: () => ({ projects, selectedPath: "/shop" }),
    useSelectedSessionId: () => onScreen,
    useOpenTab: () => (sessionId) => void opened.push(sessionId),
    usePendingApproval: (sessionId) =>
      transcripts[sessionId]?.findLast(
        (item): item is ApprovalItem => item.type === "approval" && item.decision === null,
      ),
    usePendingQuestion: (sessionId) =>
      transcripts[sessionId]?.findLast(
        (item): item is QuestionItem => item.type === "question" && item.status === "open",
      ),
    useAnswerApproval: (sessionId) => async (answer) => {
      answers.push({ sessionId, ...answer })
      return answerFails ? { text: "The session has stopped.", retryable: true } : undefined
    },
  }
  await render(
    <UiHostProvider host={host}>
      <Panel />
    </UiHostProvider>,
  )
  return { opened, answers }
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

test("a waiting session shows under Needs you with its project, and only a running one with its elapsed time", async () => {
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
  expect(needsYou.getByText("12 min").query()).toBeNull()
  await expect.element(needsYou.getByText("Waiting for you")).toBeVisible()
  await expect.element(group("Running").getByText("Add search")).toBeVisible()
  await expect.element(group("Running").getByText("3 min")).toBeVisible()
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
  await expect.element(page.getByText("Add search")).not.toBeInTheDocument()
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

test("a waiting session shows the command it asks for, and Allow answers it without opening it", async () => {
  const { opened, answers } = await mountPanel(
    [session("waits", "Write the post", "/blog", "waiting")],
    null,
    { transcripts: { waits: [approval("waits", "rm -rf drafts/old\necho done")] } },
  )

  await expect.element(page.getByTestId("working-command")).toHaveTextContent("rm -rf drafts/old")
  expect(page.getByTestId("working-command").element().textContent).not.toContain("echo done")
  await page.getByRole("button", { name: "Allow: Write the post" }).click()

  expect(answers).toEqual([{ sessionId: "waits", requestId: "waits-request", allow: true }])
  expect(opened).toEqual([])
})

test("a command continued over several lines with backslashes shows on one line", async () => {
  await mountPanel([session("waits", "Write the post", "/blog", "waiting")], null, {
    transcripts: { waits: [approval("waits", "git commit -m wip \\\n  --no-verify")] },
  })

  await expect
    .element(page.getByTestId("working-command"))
    .toHaveTextContent("git commit -m wip --no-verify")
})

test("Deny answers no, and a failed answer shows the host's message with a retry", async () => {
  const { answers } = await mountPanel(
    [session("waits", "Write the post", "/blog", "waiting")],
    null,
    { transcripts: { waits: [approval("waits", "git push")] }, answerFails: true },
  )

  await page.getByRole("button", { name: "Deny: Write the post" }).click()
  await expect.element(page.getByText("The session has stopped.")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()

  expect(answers.map((a) => a.allow)).toEqual([false, false])
})

test("a session waiting on questions shows a question mark and the first question, with no Allow or Deny", async () => {
  const question: TranscriptItem = {
    id: "waits-question",
    sessionId: "waits",
    position: 1,
    at: 0,
    type: "question",
    requestId: "waits-question",
    toolCallId: null,
    questions: [
      { question: "Which runner?", header: "Runner", options: [], multiSelect: false },
      { question: "Which folders?", header: "Folders", options: [], multiSelect: true },
    ],
    status: "open",
    answers: [],
  }
  await mountPanel(
    [{ ...session("waits", "Write the post", "/blog", "waiting"), waitingFor: "question" }],
    null,
    { transcripts: { waits: [question] } },
  )

  await expect.element(page.getByText("Waiting for your answer")).toBeInTheDocument()

  await expect.element(page.getByTestId("working-question")).toHaveTextContent("Which runner?")
  expect(page.getByRole("button", { name: /^Allow/ }).query()).toBeNull()
})

test("a long question truncates before the project name does", async () => {
  await page.viewport(280, 600)
  const question: TranscriptItem = {
    id: "waits-question",
    sessionId: "waits",
    position: 1,
    at: 0,
    type: "question",
    requestId: "waits-question",
    toolCallId: null,
    questions: [
      {
        question: "Where should the Archive all and Delete all buttons go in the sidebar?".repeat(
          3,
        ),
        header: "Place",
        options: [],
        multiSelect: false,
      },
    ],
    status: "open",
    answers: [],
  }
  await mountPanel(
    [{ ...session("waits", "Write the post", "/blog", "waiting"), waitingFor: "question" }],
    null,
    { transcripts: { waits: [question] } },
  )

  const project = page.getByText("blog", { exact: true }).element() as HTMLElement
  const shown = page.getByTestId("working-question").element() as HTMLElement
  expect(project.scrollWidth).toBeLessThanOrEqual(project.clientWidth)
  expect(shown.scrollWidth).toBeGreaterThan(shown.clientWidth)
})

test("a session in background runs under Running with its first task and how many others", async () => {
  await mountPanel(
    [
      makeTestSession({
        id: "rests",
        title: "Fix the double stop",
        projectPath: "/shop",
        status: "in_background",
        statusChangedAt: minutesAgo(2),
        backgroundTasks: [
          {
            taskId: "k1",
            kind: "agent",
            description: "Review the diff",
            itemId: "i-k1",
            toolCallId: "t-k1",
            at: 0,
          },
          {
            taskId: "k2",
            kind: "command",
            description: "End-to-end tests",
            itemId: "i-k2",
            toolCallId: "t-k2",
            at: 0,
          },
          {
            taskId: "k3",
            kind: "command",
            description: "Dev server",
            itemId: "i-k3",
            toolCallId: "t-k3",
            at: 0,
          },
        ],
      }),
    ],
    null,
  )

  const running = group("Running")
  await expect.element(running.getByText("Fix the double stop")).toBeVisible()
  await expect
    .element(running.getByTestId("working-background"))
    .toHaveTextContent("[bg] Review the diff +2")
  await expect.element(running.getByText("In background")).toBeInTheDocument()
})
