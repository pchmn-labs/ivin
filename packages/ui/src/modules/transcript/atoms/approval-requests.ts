import type { TranscriptItem } from "@ivin/contracts/transcript"
import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { pendingApprovalOf } from "./get-pending-items.ts"

interface ApprovalRequest {
  readonly title: string
  readonly item: Extract<TranscriptItem, { type: "approval" }>
}

// Reads the transcript of a session only while it waits for an approval.
export const approvalRequestsOf = strongFamily((projectPath: string) =>
  Atom.readable((get): ReadonlyArray<ApprovalRequest> =>
    get(sessionsOf(projectPath).items).flatMap((session) => {
      if (session.status !== "waiting" || session.waitingFor !== "approval") return []
      const item = get(pendingApprovalOf(session.id))
      return item === undefined ? [] : [{ title: session.title, item }]
    }),
  ),
)
