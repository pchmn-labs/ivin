import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { ApprovalItem, SlotProps, UiContext, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const mount = async (item: ApprovalItem, answer = vi.fn().mockResolvedValue(undefined)) => {
  let Approval!: ComponentType<SlotProps["transcript.approval"]>
  const ctx: UiContext = {
    pluginId: "approvals",
    slots: { add: (_slot, component) => void (Approval = component as typeof Approval) },
  }
  activate(ctx)
  const host: UiHost = {
    useSession: () => undefined,
    useSessions: () => [],
    useTranscript: () => [],
    useAnswerApproval: () => answer,
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <Approval item={item} sessionId="s1" />
    </UiHostProvider>,
  )
  return answer
}

const approval = (decision: ApprovalItem["decision"]): ApprovalItem => ({
  id: "i0",
  sessionId: "s1",
  position: 0,
  type: "approval",
  requestId: "r1",
  toolCallId: "t0",
  name: "Bash",
  input: { command: "ls" },
  decision,
})

test("a pending approval shows the tool, its input and the buttons", async () => {
  await mount(approval(null))
  await expect.element(page.getByText("Bash")).toBeVisible()
  await expect.element(page.getByText('{"command":"ls"}')).toBeVisible()
  await expect.element(page.getByText("Claude is waiting for your approval")).toBeVisible()
  await expect.element(page.getByTestId("approval-allow")).toBeVisible()
  await expect.element(page.getByTestId("approval-deny")).toBeVisible()
})

test("Allow answers the request with allow, once", async () => {
  const answer = await mount(approval(null))
  const allow = page.getByTestId("approval-allow")
  await allow.click()
  await expect.element(allow).toBeDisabled()
  await expect.element(page.getByTestId("approval-deny")).toBeDisabled()
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: true })
})

test("Deny answers the request with deny", async () => {
  const answer = await mount(approval(null))
  await page.getByTestId("approval-deny").click()
  expect(answer).toHaveBeenCalledExactlyOnceWith({ requestId: "r1", allow: false })
})

test.each([
  ["allow", "Allowed"],
  ["deny", "Denied"],
] as const)("an answered approval reads %s and has no buttons", async (decision, label) => {
  await mount(approval(decision))
  await expect.element(page.getByTestId("approval-decision")).toHaveTextContent(label)
  await expect.element(page.getByTestId("approval-allow")).not.toBeInTheDocument()
  await expect.element(page.getByTestId("approval-deny")).not.toBeInTheDocument()
})

test("a failed answer shows an error and lets the user try again", async () => {
  const answer = vi.fn().mockRejectedValueOnce(new Error("not open")).mockResolvedValue(undefined)
  await mount(approval(null), answer)
  await page.getByTestId("approval-allow").click()
  await expect.element(page.getByTestId("approval-error")).toBeVisible()
  await expect.element(page.getByTestId("approval-allow")).toBeEnabled()
  await page.getByTestId("approval-allow").click()
  await expect.element(page.getByTestId("approval-error")).not.toBeInTheDocument()
  expect(answer).toHaveBeenCalledTimes(2)
})
