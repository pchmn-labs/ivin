import { useEffect, useState } from "react"
import {
  ActionSheet,
  Button,
  ChoiceList,
  ErrorMessage,
  Icon,
  Stack,
  Steps,
  Text,
  defineUi,
  pendingQuestion,
  useAnswerQuestion,
  useTranscript,
} from "@ivin/plugin-api/ui"
import type { ActionFailure, QuestionAnswer, QuestionItem, SlotProps } from "@ivin/plugin-api/ui"
import { OTHER, answersOf, emptyDrafts, isAnswered, nextStep, type Draft } from "./rules/drafts.ts"

// By request id, so a session switch or a closed tab does not lose what the user picked.
const progress = new Map<string, { drafts: ReadonlyArray<Draft>; step: number }>()

const KEYS = [
  { key: "↑↓", label: "Navigate" },
  { key: "Space", label: "Select" },
  { key: "Esc", label: "Decline" },
]

function UnansweredRecord({ item }: { item: QuestionItem }) {
  return (
    <Stack direction="row" gap={2} align="start" data-testid="question-record">
      <Text size="sm" tone="muted">
        <Icon name="circle-alert" size={14} />
      </Text>
      <Stack gap={0}>
        <Text size="sm" tone="muted">
          Not answered:
        </Text>
        {item.questions.map(({ question }, index) => (
          <Stack key={index} direction="row" gap={1} align="baseline">
            <Text size="sm" tone="muted">
              •
            </Text>
            <Text size="sm" tone="muted">
              {question}
            </Text>
          </Stack>
        ))}
        <Text size="xs" tone="faint">
          The agent stopped while it waited, so it can no longer take your answers.
        </Text>
      </Stack>
    </Stack>
  )
}

function QuestionRecord({ item }: SlotProps["transcript.question"]) {
  if (item.status === "unanswered") return <UnansweredRecord item={item} />
  const count = item.questions.length
  if (item.status === "declined")
    return (
      <Stack direction="row" gap={2} align="center" data-testid="question-record">
        <Icon name="x" size={14} />
        <Text size="sm" tone="muted">
          Declined the agent's questions
        </Text>
      </Stack>
    )
  return (
    <Stack gap={1} data-testid="question-record">
      <Stack direction="row" gap={2} align="center">
        <Icon name="question" size={14} />
        <Text size="sm" weight="medium">
          {count === 1 ? "Asked a question" : `Asked ${count} questions`}
        </Text>
      </Stack>
      {item.answers.map((answer, index) => (
        <Stack key={answer.question} direction="row" gap={2} align="baseline">
          <Text size="sm" tone="muted">
            {item.questions[index]?.header ?? answer.question}
          </Text>
          <Text size="sm">{answer.choices.join(", ")}</Text>
        </Stack>
      ))}
    </Stack>
  )
}

function PendingSheet({
  sessionId,
  item,
  isEmptyComposer,
}: {
  sessionId: string
  item: QuestionItem
  isEmptyComposer: SlotProps["composer.above"]["isEmptyComposer"]
}) {
  const answer = useAnswerQuestion(sessionId)
  const { questions } = item
  const kept = progress.get(item.requestId)
  const [drafts, setDrafts] = useState<ReadonlyArray<Draft>>(
    () => kept?.drafts ?? emptyDrafts(questions),
  )
  const [step, setStep] = useState(kept?.step ?? 0)
  useEffect(() => {
    progress.set(item.requestId, { drafts, step })
  }, [item.requestId, drafts, step])
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<
    (ActionFailure & { answers: QuestionAnswer[] | null }) | null
  >(null)
  const question = questions[step]!
  const draft = drafts[step]!
  const last = step === questions.length - 1

  const send = (answers: QuestionAnswer[] | null) => {
    if (sending) return
    setSending(true)
    setFailure(null)
    void answer({ requestId: item.requestId, answers }).then((failed) => {
      if (failed === undefined) return void progress.delete(item.requestId)
      setFailure({ answers, ...failed })
      setSending(false)
    })
  }

  const update = (patch: Partial<Draft>) =>
    setDrafts((all) => all.map((each, index) => (index === step ? { ...each, ...patch } : each)))

  const confirm = (selected: ReadonlyArray<string>) => {
    const next = drafts.map((each, index) => (index === step ? { ...each, selected } : each))
    setDrafts(next)
    if (!isAnswered(question, next[step]!)) return
    const to = nextStep(questions, next, step)
    if (to === "send") send(answersOf(questions, next))
    else setStep(to)
  }

  const chosen = draft.selected.filter((id) => id !== OTHER || draft.other.trim() !== "").length

  return (
    <ActionSheet
      tone="attention"
      icon="question"
      title="The agent asks"
      aside={
        questions.length > 1 ? (
          <Steps
            label="Questions"
            steps={questions.map((each, index) => ({
              label: each.header,
              done: isAnswered(each, drafts[index]!),
            }))}
            current={step}
            onSelect={setStep}
          />
        ) : undefined
      }
      keys={KEYS}
      actions={
        <Stack direction="row" align="center" gap={3}>
          <Button variant="ghost" onClick={() => send(null)} disabled={sending}>
            Decline
          </Button>
          {question.multiSelect ? (
            <>
              <Text as="span" size="xs" tone="faint">
                {chosen > 0 ? `${chosen} chosen` : ""}
              </Text>
              <Button
                variant="primary"
                onClick={() => confirm(draft.selected)}
                disabled={sending || chosen === 0}
              >
                {last ? "Send" : "Continue"}
              </Button>
            </>
          ) : null}
        </Stack>
      }
      data-testid="question-sheet"
    >
      <Stack gap={2}>
        <Stack gap={1}>
          <Text>{question.question}</Text>
          {question.multiSelect ? (
            <Text size="xs" tone="faint">
              Choose one or more
            </Text>
          ) : null}
        </Stack>
        <ChoiceList
          key={step}
          label={question.header}
          multiple={question.multiSelect}
          options={question.options.map((option, index) => ({
            id: String(index),
            label: option.label,
            ...(option.description === "" ? {} : { description: option.description }),
          }))}
          selected={draft.selected}
          onSelectedChange={(selected) => update({ selected })}
          onSubmit={confirm}
          onEscape={() => send(null)}
          onPrevious={() => setStep((at) => Math.max(0, at - 1))}
          onNext={() => setStep((at) => Math.min(questions.length - 1, at + 1))}
          other={{
            id: OTHER,
            label: "Other",
            placeholder: "Type your own answer",
            text: draft.other,
            onTextChange: (other) => update({ other }),
          }}
          disabled={sending}
          keyboardSource={isEmptyComposer}
          autoFocus
        />
        {failure && (
          <ErrorMessage
            message={failure.text}
            {...(failure.retryable && { onRetry: () => send(failure.answers) })}
          />
        )}
      </Stack>
    </ActionSheet>
  )
}

function QuestionSheet({ session, isEmptyComposer }: SlotProps["composer.above"]) {
  const pending = pendingQuestion(useTranscript(session.id))
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
  ctx.slots.add("transcript.question", QuestionRecord, { name: "default" })
  ctx.slots.add("composer.above", QuestionSheet, { name: "sheet" })
})
