import type { TranscriptItem } from "@ivin/contracts/transcript"
import { strongFamily } from "@ivin/state/strong-family"
import { DateTime } from "effect"
import { Atom } from "effect/reactivity"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { pendingApprovalOf } from "./get-pending-items.ts"

export interface ApprovalWait {
  // One per time a session starts waiting for an approval.
  readonly key: string
  readonly title: string
  // Undefined until the session's transcript has loaded.
  readonly item: Extract<TranscriptItem, { type: "approval" }> | undefined
}

export interface ApprovalWaits {
  readonly listed: boolean
  readonly waits: ReadonlyArray<ApprovalWait>
}

// Reads the transcript of a session only while it waits for an approval.
export const approvalWaitsOf = strongFamily((projectPath: string) =>
  Atom.readable((get): ApprovalWaits => {
    const sessions = get(sessionsOf(projectPath).items)
    return {
      listed: sessions.length > 0,
      waits: sessions.flatMap((session) =>
        session.status === "waiting" && session.waitingFor === "approval"
          ? [
              {
                key: `${session.id}@${DateTime.toEpochMillis(session.statusChangedAt)}`,
                title: session.title,
                item: get(pendingApprovalOf(session.id)),
              },
            ]
          : [],
      ),
    }
  }),
)
