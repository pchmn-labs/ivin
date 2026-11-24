import { useState } from "react"
import {
  ActionSheet,
  ErrorMessage,
  Icon,
  OptionList,
  Stack,
  Text,
  defineUi,
  formatToolInput,
  useAnswerApproval,
  usePendingApproval,
} from "@ivin/plugin-api/ui"
import type { ActionFailure, ApprovalItem, SlotProps } from "@ivin/plugin-api/ui"

const OPTIONS = [
  { id: "allow", label: "Allow" },
  { id: "deny", label: "Deny", hint: "Esc" },
]

const firstLine = (text: string) => text.split("\n", 1)[0] ?? ""

function UnansweredRecord({ input }: { input: string }) {
  return (
    <Stack direction="row" gap={2} align="start">
      <Text size="sm" tone="muted">
        <Icon name="circle-alert" size={14} />
      </Text>
      <Stack gap={0}>
        <Text size="sm" tone="muted" truncate title={input} data-testid="approval-decision">
          Not answered:{" "}
          <Text as="span" size="sm" mono>
            {firstLine(input)}
          </Text>
        </Text>
        <Text size="xs" tone="faint">
          The agent stopped while it waited, so it can no longer take your answer.
        </Text>
      </Stack>
    </Stack>
  )
}

function ApprovalRecord({ item }: SlotProps["transcript.approval"]) {
  const input = formatToolInput(item.name, item.input)
  if (item.decision === "unanswered") return <UnansweredRecord input={input} />
  // An allowed call shows as its tool row.
  if (item.decision !== "deny") return null
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
      tone="attention"
      title="Approval needed"
      detail={formatToolInput(item.name, item.input)}
      keys={[
        { key: "↑↓", label: "Choose" },
        { key: "↵", label: "Answer" },
      ]}
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
  const pending = usePendingApproval(session.id)
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
