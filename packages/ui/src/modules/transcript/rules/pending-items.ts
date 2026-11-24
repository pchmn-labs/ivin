import type { TranscriptItem } from "@ivin/contracts/transcript"

type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
type QuestionItem = Extract<TranscriptItem, { type: "question" }>

export const pendingApproval = (items: ReadonlyArray<TranscriptItem>): ApprovalItem | undefined =>
  items
    .filter((item): item is ApprovalItem => item.type === "approval" && item.decision === null)
    .at(-1)

export const pendingQuestion = (items: ReadonlyArray<TranscriptItem>): QuestionItem | undefined =>
  items
    .filter((item): item is QuestionItem => item.type === "question" && item.status === "open")
    .at(-1)
