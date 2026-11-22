import { defaultSettings } from "../../../packages/contracts/src/setting.ts"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../../packages/ui/src/app/host-components.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type {
  QuestionItem,
  Session,
  SlotName,
  SlotProps,
  TranscriptItem,
  UiContext,
  UiHost,
} from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const session = { id: "s1" } as Session

const isEmptyComposer = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement && target.value === ""

const mount = async (
  items: ReadonlyArray<TranscriptItem>,
  answer = vi.fn().mockResolvedValue(undefined),
) => {
  const slots: Partial<Record<SlotName, ComponentType<never>>> = {}
  const ctx: UiContext = {
    pluginId: "questions",
    slots: { add: (slot, component) => void (slots[slot] = component as ComponentType<never>) },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Record = slots["transcript.question"] as ComponentType<SlotProps["transcript.question"]>
  const Sheet = slots["composer.above"] as ComponentType<SlotProps["composer.above"]>
  const host: UiHost = {
    useSession: () => undefined,
    useSessions: () => [],
    useProjects: () => ({ projects: [], selectedPath: null }),
    useSelectedSessionId: () => null,
    useTabs: () => [],
    useOpenTab: () => () => {},
    useTranscript: () => items,
    useAnnotations: () => [],
    useAnswerApproval: () => async () => undefined,
    useAnswerQuestion: () => answer,
    useListFolder: () => async () => ({ kind: "listed" as const, entries: [] }),
    useOpenFile: () => async () => undefined,
    useListFiles: () => async () => ({ kind: "listed" as const, paths: [], truncated: false }),
    useFolderChanges: () => undefined,
    useGitStatus: () => [],
    useFileOnScreen: () => null,
    useChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenDiff: () => async () => undefined,
    useDiffOnScreen: () => null,
    useCommittedChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenCommittedDiff: () => async () => undefined,
    useCommittedDiffOnScreen: () => null,
    useDiscardChange: () => async () => undefined,
    useDiscardAllChanges: () => async () => undefined,
    useSettings: () => defaultSettings,
    useSessionActions: () => ({ items: [], failure: null }),
    components: hostComponents,
  }
  const screen = await render(
    <UiHostProvider host={host}>
      {items.map((item) =>
        item.type === "question" ? <Record key={item.id} item={item} sessionId="s1" /> : null,
      )}
      <Sheet session={session} isEmptyComposer={isEmptyComposer} />
      <textarea aria-label="Message" />
    </UiHostProvider>,
  )
  return Object.assign(answer, { unmount: () => screen.unmount() })
}

const questions: QuestionItem["questions"] = [
  {
    question: "Which test runner?",
    header: "Runner",
    options: [
      { label: "Vitest", description: "Already set up." },
      { label: "Jest", description: "Needs a config." },
    ],
    multiSelect: false,
  },
  {
    question: "Which folders?",
    header: "Folders",
    options: [
      { label: "src/orders", description: "" },
      { label: "src/billing", description: "" },
    ],
    multiSelect: true,
  },
]

const asked = (
  status: QuestionItem["status"] = "open",
  answers: QuestionItem["answers"] = [],
): QuestionItem => ({
  id: "q",
  sessionId: "s1",
  position: 0,
  at: 0,
  type: "question",
  requestId: "r1",
  toolCallId: "t1",
  questions,
  status,
  answers,
})

const sheet = () => page.getByTestId("question-sheet")

test("an open question docks the question sheet on its first question", async () => {
  await mount([asked()])
  await expect.element(sheet().getByText("The agent asks")).toBeVisible()
  await expect.element(page.getByText("Approval needed")).not.toBeInTheDocument()
  await expect
    .element(
      page.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: "Runner" }),
    )
    .toHaveAttribute("aria-current", "step")
  await expect.element(page.getByText("Which test runner?")).toBeVisible()
  await expect.element(page.getByRole("radio", { name: /^Vitest/ })).toHaveFocus()
  await expect.element(sheet().getByText("Esc", { exact: true })).toBeVisible()
  await expect.element(sheet().getByRole("button", { name: "Decline" })).toBeVisible()
})

test("answered by keyboard only: a number, then ticks and Enter send every answer", async () => {
  const answer = await mount([asked()])
  await userEvent.keyboard("2")
  await expect.element(page.getByText("Which folders?")).toBeVisible()
  await expect.element(page.getByText("Choose one or more")).toBeVisible()
  await expect.element(page.getByRole("checkbox", { name: /^src\/orders/ })).toHaveFocus()
  await userEvent.keyboard(" {ArrowDown} {Enter}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({
    requestId: "r1",
    answers: [
      { question: "Which test runner?", choices: ["Jest"] },
      { question: "Which folders?", choices: ["src/orders", "src/billing"] },
    ],
  })
})

test("Other sends the user's own text, and the Continue button sends the last question", async () => {
  const answer = await mount([asked()])
  await userEvent.keyboard("3")
  await userEvent.keyboard("Mocha{Enter}")
  await expect.element(page.getByRole("button", { name: "Send" })).toBeDisabled()
  await userEvent.keyboard(" ")
  await expect.element(page.getByText("1 chosen")).toBeVisible()
  await page.getByRole("button", { name: "Send" }).click()
  expect(answer).toHaveBeenCalledExactlyOnceWith({
    requestId: "r1",
    answers: [
      { question: "Which test runner?", choices: ["Mocha"] },
      { question: "Which folders?", choices: ["src/orders"] },
    ],
  })
})

test("Esc declines the questions", async () => {
  const answer = await mount([asked()])
  await userEvent.keyboard("{Escape}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", answers: null })
})

test("the steps move between questions, by the arrows or a click", async () => {
  await mount([asked()])
  await userEvent.keyboard("{ArrowRight}")
  await expect.element(page.getByText("Which folders?")).toBeVisible()
  await page.getByRole("button", { name: "Runner" }).click()
  await expect.element(page.getByText("Which test runner?")).toBeVisible()
})

test("a failed answer shows the host's message with Retry", async () => {
  const answer = vi
    .fn()
    .mockResolvedValueOnce({ text: "Your answers were not sent.", retryable: true })
    .mockResolvedValue(undefined)
  await mount([asked()], answer)
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByText("Your answers were not sent.")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  expect(answer).toHaveBeenLastCalledWith({ requestId: "r1", answers: null })
})

test("answered questions leave each header with its answer in the transcript, and no sheet", async () => {
  await mount([
    asked("answered", [
      { question: "Which test runner?", choices: ["Vitest"] },
      { question: "Which folders?", choices: ["src/orders", "src/billing"] },
    ]),
  ])
  await expect.element(sheet()).not.toBeInTheDocument()
  const record = page.getByTestId("question-record")
  await expect.element(record.getByText("Asked 2 questions")).toBeVisible()
  await expect.element(record.getByText("src/orders, src/billing")).toBeVisible()
  await expect.element(record.getByText("Folders")).toBeVisible()
})

test("declined questions say so in the transcript", async () => {
  await mount([asked("declined")])
  await expect
    .element(page.getByTestId("question-record").getByText("Declined the agent's questions"))
    .toBeVisible()
})

test("the answers picked so far survive the sheet closing and opening again", async () => {
  const requestId = crypto.randomUUID()
  const first = await mount([{ ...asked(), requestId }])
  await userEvent.keyboard("2")
  await expect.element(page.getByText("Which folders?")).toBeVisible()
  await userEvent.keyboard(" ")
  await first.unmount()

  await mount([{ ...asked(), requestId }])
  await expect.element(page.getByText("Which folders?")).toBeVisible()
  await expect.element(page.getByRole("checkbox", { name: /^src\/orders/ })).toBeChecked()
})
