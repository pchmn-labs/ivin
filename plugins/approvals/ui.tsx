import { useState } from "react"
import {
  Block,
  Button,
  CodeBlock,
  Icon,
  Stack,
  Text,
  defineUi,
  useAnswerApproval,
} from "@ivin/plugin-api/ui"
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
    <Block tone={item.decision === null ? "attention" : "plain"}>
      <Stack gap={3}>
        <Text weight="medium">{item.name}</Text>
        <CodeBlock text={formatInput(item.name, item.input)} />
        {item.decision === null ? (
          <Stack gap={2}>
            <Text size="sm" tone="danger" weight="medium">
              Claude is waiting for your approval
            </Text>
            <Stack direction="row" gap={2}>
              <Button
                variant="primary"
                size="sm"
                data-testid="approval-allow"
                disabled={clicked}
                onClick={() => respond(true)}
              >
                Allow
              </Button>
              <Button
                variant="secondary"
                size="sm"
                data-testid="approval-deny"
                disabled={clicked}
                onClick={() => respond(false)}
              >
                Deny
              </Button>
            </Stack>
            {failed && (
              <Text size="sm" tone="danger" role="alert" data-testid="approval-error">
                Could not send your answer
              </Text>
            )}
          </Stack>
        ) : (
          <Stack direction="row" gap={2} align="center">
            <Icon name={item.decision === "allow" ? "check" : "x"} size={14} />
            <Text weight="medium" data-testid="approval-decision">
              {DECISION_LABELS[item.decision]}
            </Text>
          </Stack>
        )}
      </Stack>
    </Block>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.approval", Approval, { name: "default" })
})
