import { Atom } from "effect/reactivity"
import { strongFamily } from "@ivin/state/strong-family"
import { pendingApproval, pendingQuestion } from "../rules/pending-items.ts"
import { transcriptOf } from "./get-items.ts"

// A derived atom notifies only when its item changes, not when any other transcript item arrives.
export const pendingApprovalOf = strongFamily((sessionId: string) =>
  Atom.readable((get) => pendingApproval(get(transcriptOf(sessionId).list.items))),
)

export const pendingQuestionOf = strongFamily((sessionId: string) =>
  Atom.readable((get) => pendingQuestion(get(transcriptOf(sessionId).list.items))),
)
