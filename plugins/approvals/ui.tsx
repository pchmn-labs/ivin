import { useState } from "react"
import {
  ActionSheet,
  ErrorMessage,
  Icon,
  OptionList,
  Stack,
  Text,
  defineUi,
  useAnswerApproval,
  useTranscript,
} from "@ivin/plugin-api/ui"
import type { ActionFailure, ApprovalItem, SlotProps } from "@ivin/plugin-api/ui"
import { formatInput } from "./rules/format-input.ts"

const OPTIONS = [
  { id: "allow", label: "Allow" },
  { id: "deny", label: "Deny", hint: "Esc" },
]

const firstLine = (text: string) => text.split("\n", 1)[0] ?? ""

function ApprovalRecord({ item }: SlotProps["transcript.approval"]) {
  // An allowed call shows as its tool row; only a denial needs a trace.
  if (item.decision !== "deny") return null
  const input = formatInput(item.name, item.input)
  return (
    <Stack direction="row" gap={2} align="center">
      <Icon name="x" size={14} />
      <Text size="sm" tone="muted" truncate title={input} data-testid="approval-decision">
        Denied:{" "}
        <Text as="span" size="sm" mono>
          {firstLine(input)}
        </Text>
      </Text>
    </Stack>
  )
}

function PendingSheet({
  sessionId,
  item,
  isEmptyComposer,
}: {
  sessionId: string
  item: ApprovalItem
  isEmptyComposer: SlotProps["composer.above"]["isEmptyComposer"]
}) {
  const answer = useAnswerApproval(sessionId)
  const [choice, setChoice] = useState("allow")
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<(ActionFailure & { id: string }) | null>(null)

  const respond = (id: string) => {
    if (sending) return
    setSending(true)
    setFailure(null)
    void answer({ requestId: item.requestId, allow: id === "allow" }).then((failed) => {
      if (failed === undefined) return
      setFailure({ id, ...failed })
      setSending(false)
    })
  }

  return (
    <ActionSheet
      tone="danger"
      title="Approval needed"
      detail={formatInput(item.name, item.input)}
      hint="↑↓ to choose, Enter to answer, Esc to deny"
      data-testid="approval-sheet"
    >
      <OptionList
        label="Answer"
        options={OPTIONS}
        value={choice}
        onChange={setChoice}
        onSubmit={respond}
        onEscape={() => respond("deny")}
        submitOnClick
        disabled={sending}
        keyboardSource={isEmptyComposer}
        autoFocus
      />
      {failure && (
        <ErrorMessage
          message={failure.text}
          {...(failure.retryable && { onRetry: () => respond(failure.id) })}
        />
      )}
    </ActionSheet>
  )
}

function ApprovalSheet({ session, isEmptyComposer }: SlotProps["composer.above"]) {
  const pending = useTranscript(session.id)
    .filter((item): item is ApprovalItem => item.type === "approval" && item.decision === null)
    .at(-1)
  if (pending === undefined) return null
  return (
    <PendingSheet
      key={pending.requestId}
      sessionId={session.id}
      item={pending}
      isEmptyComposer={isEmptyComposer}
    />
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("transcript.approval", ApprovalRecord, { name: "default" })
  ctx.slots.add("composer.above", ApprovalSheet, { name: "sheet" })
})
