import type { TranscriptItem } from "@ivin/contracts/transcript"

type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>

// The approval the session waits on: the last one still unanswered.
export const pendingApproval = (items: ReadonlyArray<TranscriptItem>): ApprovalItem | undefined =>
  items
    .filter((item): item is ApprovalItem => item.type === "approval" && item.decision === null)
    .at(-1)
