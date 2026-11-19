import { expect, test } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { pendingApproval } from "./pending-approval.ts"

const approval = (id: string, decision: "allow" | "deny" | null): TranscriptItem => ({
  id,
  sessionId: "s",
  position: 0,
  type: "approval",
  requestId: `r-${id}`,
  toolCallId: null,
  name: "Bash",
  input: { command: "ls" },
  decision,
})

test("the pending approval is the last unanswered one", () => {
  expect(
    pendingApproval([approval("a", null), approval("b", "allow"), approval("c", null)])?.id,
  ).toBe("c")
})

test("a transcript whose approvals are all answered has none pending", () => {
  expect(pendingApproval([approval("a", "deny")])).toBeUndefined()
  expect(pendingApproval([])).toBeUndefined()
})
