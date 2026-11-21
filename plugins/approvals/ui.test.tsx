import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type {
  ApprovalItem,
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
    pluginId: "approvals",
    slots: { add: (slot, component) => void (slots[slot] = component as ComponentType<never>) },
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const Record = slots["transcript.approval"] as ComponentType<SlotProps["transcript.approval"]>
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
    useAnswerApproval: () => answer,
    useListFolder: () => async () => ({ kind: "listed" as const, entries: [] }),
    useOpenFile: () => async () => undefined,
    useSessionActions: () => ({ items: [], failure: null }),
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      {items.map((item) =>
        item.type === "approval" ? <Record key={item.id} item={item} sessionId="s1" /> : null,
      )}
      <Sheet session={session} isEmptyComposer={isEmptyComposer} />
      <textarea aria-label="Message" />
    </UiHostProvider>,
  )
  return answer
}

const approval = (decision: ApprovalItem["decision"], requestId = "r1"): ApprovalItem => ({
  id: `i-${requestId}`,
  sessionId: "s1",
  position: 0,
  at: 0,
  type: "approval",
  requestId,
  toolCallId: "t0",
  name: "Bash",
  input: { command: "pnpm test" },
  decision,
})

test("a pending approval docks a sheet with the command and the two options", async () => {
  await mount([approval(null)])
  await expect.element(page.getByText("Approval needed")).toBeVisible()
  await expect.element(page.getByText("pnpm test", { exact: true })).toBeVisible()
  await expect.element(page.getByRole("radio", { name: "Allow" })).toBeChecked()
  await expect.element(page.getByRole("radio", { name: /^Deny/ })).not.toBeChecked()
  await expect.element(page.getByText("↑↓ to choose, Enter to answer, Esc to deny")).toBeVisible()
  await expect.element(page.getByTestId("approval-decision")).not.toBeInTheDocument()
})

test("no pending approval means no sheet", async () => {
  await mount([approval("allow")])
  await expect.element(page.getByTestId("approval-sheet")).not.toBeInTheDocument()
})

test("clicking Allow answers allow, once", async () => {
  const answer = await mount([approval(null)])
  await page.getByRole("radio", { name: "Allow" }).click()
  await expect.element(page.getByRole("radio", { name: /^Deny/ })).toBeDisabled()
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: true })
})

test("clicking Deny answers deny", async () => {
  const answer = await mount([approval(null)])
  await page.getByRole("radio", { name: /^Deny/ }).click()
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test("the arrows move the choice and Enter answers it", async () => {
  const answer = await mount([approval(null)])
  page.getByRole("radio", { name: "Allow" }).element().focus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(page.getByRole("radio", { name: /^Deny/ })).toBeChecked()
  await expect.element(page.getByRole("radio", { name: /^Deny/ })).toHaveFocus()
  await userEvent.keyboard("{ArrowUp}")
  await expect.element(page.getByRole("radio", { name: "Allow" })).toBeChecked()
  await userEvent.keyboard("{ArrowDown}{Enter}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test("Esc denies", async () => {
  const answer = await mount([approval(null)])
  page.getByRole("radio", { name: "Allow" }).element().focus()
  await userEvent.keyboard("{Escape}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test("the arrows, Enter and Esc work from the empty composer", async () => {
  const answer = await mount([approval(null)])
  const composer = page.getByRole("textbox", { name: "Message" })
  await composer.click()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(page.getByRole("radio", { name: /^Deny/ })).toBeChecked()
  await expect.element(composer).toHaveFocus()
  await userEvent.keyboard("{Enter}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test("Esc from the empty composer denies", async () => {
  const answer = await mount([approval(null)])
  await page.getByRole("textbox", { name: "Message" }).click()
  await userEvent.keyboard("{Escape}")
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test("a composer with text keeps its keys", async () => {
  const answer = await mount([approval(null)])
  const composer = page.getByRole("textbox", { name: "Message" })
  await composer.fill("hello")
  await userEvent.keyboard("{ArrowDown}{Enter}{Escape}")
  await expect.element(page.getByRole("radio", { name: "Allow" })).toBeChecked()
  expect(answer).not.toHaveBeenCalled()
})

test("Enter with the focus on the page body answers nothing", async () => {
  const answer = await mount([approval(null)])
  ;(document.activeElement as HTMLElement | null)?.blur()
  await userEvent.keyboard("{Enter}{Escape}")
  expect(answer).not.toHaveBeenCalled()
})

test("a denied approval keeps to one line, truncated, with the full text in the title", async () => {
  const long = approval("deny")
  await mount([{ ...long, input: { command: "echo first\necho second" } }])
  const record = page.getByTestId("approval-decision")
  await expect.element(record).toHaveTextContent("Denied: echo first")
  await expect.element(record).not.toHaveTextContent("second")
  await expect.element(record).toHaveAttribute("title", "echo first\necho second")
})

test("a denied approval leaves one line and an allowed one leaves none", async () => {
  await mount([approval("deny")])
  await expect.element(page.getByTestId("approval-decision")).toHaveTextContent("Denied: pnpm test")
  await expect.element(page.getByRole("radio", { name: "Allow" })).not.toBeInTheDocument()
  document.body.replaceChildren()
  await mount([approval("allow")])
  expect(page.getByTestId("approval-decision").query()).toBeNull()
  await expect.element(page.getByRole("radio", { name: "Allow" })).not.toBeInTheDocument()
})

test("a failed answer shows its message, and Retry sends the same answer", async () => {
  const answer = vi
    .fn()
    .mockResolvedValueOnce({ text: "Your answer was not sent.", retryable: true })
    .mockResolvedValue(undefined)
  await mount([approval(null)], answer)
  await page.getByRole("radio", { name: /^Deny/ }).click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("Your answer was not sent.")).toBeVisible()
  await expect.element(page.getByRole("radio", { name: "Allow" })).toBeEnabled()
  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  expect(answer).toHaveBeenCalledTimes(2)
  expect(answer).toHaveBeenLastCalledWith({ requestId: "r1", allow: false })
})

test("a failure a retry cannot fix shows no Retry", async () => {
  const answer = vi
    .fn()
    .mockResolvedValue({ text: "This approval was already answered.", retryable: false })
  await mount([approval(null)], answer)
  await page.getByRole("radio", { name: "Allow" }).click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("This approval was already answered.")).toBeVisible()
  expect(alert.getByRole("button", { name: "Retry" }).query()).toBeNull()
})
