import type { TranscriptItem } from "@ivin/contracts/transcript"

type QuestionItem = Extract<TranscriptItem, { type: "question" }>

// The questions the session waits on: the last ones still unanswered.
export const pendingQuestion = (items: ReadonlyArray<TranscriptItem>): QuestionItem | undefined =>
  items
    .filter((item): item is QuestionItem => item.type === "question" && item.status === "open")
    .at(-1)
