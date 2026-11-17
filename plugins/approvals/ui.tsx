import { useState } from "react"
import { defineUi, useAnswerApproval } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { formatInput } from "./rules/format-input.ts"

const DECISION_LABELS = { allow: "Allowed", deny: "Denied" } as const

function Approval({ item, sessionId }: SlotProps["transcript.approval"]) {
  const answer = useAnswerApproval(sessionId)
  const [clicked, setClicked] = useState(false)

  const [failed, setFailed] = useState(false)

  const respond = (allow: boolean) => {
    setClicked(true)
    setFailed(false)
    answer({ requestId: item.requestId, allow }).catch(() => {
      setFailed(true)
      setClicked(false)
    })
  }

  return (
    <div>
      <p style={{ margin: 0 }}>
        <strong>{item.name}</strong>
      </p>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {formatInput(item.input)}
      </pre>
      {item.decision === null ? (
        <div>
          <p style={{ margin: 0 }}>Claude is waiting for your approval</p>
          <button data-testid="approval-allow" disabled={clicked} onClick={() => respond(true)}>
            Allow
          </button>{" "}
          <button data-testid="approval-deny" disabled={clicked} onClick={() => respond(false)}>
            Deny
          </button>
          {failed && (
            <p data-testid="approval-error" role="alert" style={{ margin: 0 }}>
              Could not send your answer
            </p>
          )}
        </div>
      ) : (
        <p data-testid="approval-decision" style={{ margin: 0 }}>
          {DECISION_LABELS[item.decision]}
        </p>
      )}
    </div>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.approval", Approval, { name: "default" })
})
