import { useEffect, useRef, useState } from "react"
import {
  ActionSheet,
  Block,
  Button,
  ComposerFrame,
  ErrorMessage,
  IconButton,
  MessageField,
  PickWorkingFolder,
  RunOptionsMenu,
  SessionLocationPicker,
  Slot,
  Stack,
  Text,
  Tooltip,
  defineUi,
  statusLabel,
  useCommandHandler,
  useDraft,
  useInterruptSession,
  useKeyHint,
  useOfferedRunOptions,
  useSendMessage,
  useSendNow,
  useTakeUnreadMessages,
  useSession,
  useSetRunOptions,
  type ActionFailure,
  type Draft,
  type ErrorMessageProps,
  type MessageFieldHandle,
  type RunOptions,
  type RunOptionsMenuState,
  type Session,
} from "@ivin/plugin-api/ui"
import { useCommandCompletion } from "./hooks/use-command-completion.tsx"
import { pendingText, withRelaunchMessage } from "./rules/draft.ts"
import { changedRunOption, goBackLabel, relaunchFailureText } from "./rules/relaunch-failure.ts"

function PendingSheet({ session }: { session: Session }) {
  const { sendNow, failure } = useSendNow(session.id)
  const pending = session.pendingMessages
  useCommandHandler("session.sendNow", sendNow, pending.length > 0)
  const sendNowHint = useKeyHint("Stops this turn and sends your messages", "session.sendNow")
  if (pending.length === 0) return null
  return (
    <>
      <ActionSheet
        icon="clock"
        title={
          pending.length === 1
            ? "Sent to the agent"
            : `${pending.length} messages sent to the agent`
        }
        note={`Read once the agent's current tool call or turn ends. Stop puts ${pending.length === 1 ? "it" : "them"} back here.`}
        actions={
          <Tooltip content={sendNowHint}>
            <Button variant="ghost" size="sm" onClick={sendNow}>
              Send now
            </Button>
          </Tooltip>
        }
        data-testid="composer-pending"
      >
        <Stack as="ul" gap={2}>
          {pending.map((message) => (
            <Stack as="li" key={message.id}>
              <Block tone="bubble">
                <Text size="sm" truncate title={message.text}>
                  {pendingText(message)}
                </Text>
              </Block>
            </Stack>
          ))}
        </Stack>
      </ActionSheet>
      {failure && <ErrorMessage {...failure} />}
    </>
  )
}

function Composer({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useDraft(sessionId)
  const text = draft.text
  const field = useRef<MessageFieldHandle>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const { send, failure } = useSendMessage(sessionId)
  useTakeUnreadMessages(sessionId)
  const interrupt = useInterruptSession(sessionId)
  const session = useSession(sessionId)
  const running =
    session?.status === "working" ||
    session?.status === "waiting" ||
    session?.status === "in_background"
  const preparing = session?.status === "preparing_worktree"
  const setRunOptions = useSetRunOptions(sessionId)
  const offered = useOfferedRunOptions(sessionId)
  const completion = useCommandCompletion(sessionId)
  const [optionsFailure, setOptionsFailure] = useState<
    (ActionFailure & { options: Partial<RunOptions> }) | null
  >(null)
  const relaunchFailure = session?.relaunchFailure ?? null
  const relaunchFailureKey = relaunchFailure && JSON.stringify(relaunchFailure)
  const [menu, setMenu] = useState<RunOptionsMenuState>({ open: false, start: "model" })

  const sessionLoaded = session !== undefined
  useEffect(() => {
    // The approval sheet takes the focus, and a tab reached by the keyboard keeps it.
    if (!sessionLoaded || session.status === "waiting") return
    if (document.activeElement?.matches('[role="tab"]:focus-visible')) return
    field.current?.focus()
  }, [sessionLoaded])

  useEffect(() => {
    if (relaunchFailure !== null)
      setDraft((current) => withRelaunchMessage(current, relaunchFailure))
  }, [relaunchFailureKey])

  const changeRunOptions = (options: Partial<RunOptions>) => {
    setOptionsFailure(null)
    void setRunOptions(options).then((failed) => {
      if (failed !== undefined) setOptionsFailure({ options, ...failed })
    })
  }

  const sendDraft = (sent: Draft) => {
    if (preparing) return
    setRefusal(null)
    send(sent)
  }
  const submit = () => {
    if (text.trim() !== "") sendDraft(draft)
  }

  useCommandHandler("composer.send", submit)
  const sendHint = useKeyHint("Send", "composer.send")
  const interruptHint = useKeyHint("Interrupt", "session.interrupt")

  const isEmptyComposer = (target: EventTarget | null) =>
    text === "" && field.current?.holds(target) === true

  const shown: ErrorMessageProps | null = failure
    ? failure
    : refusal !== null
      ? { message: refusal }
      : optionsFailure
        ? {
            message: optionsFailure.text,
            ...(optionsFailure.retryable && {
              onRetry: () => changeRunOptions(optionsFailure.options),
            }),
          }
        : null
  const alert = shown && <ErrorMessage {...shown} />
  const status = <Slot slot="composer.status" props={{ sessionId }} />
  const location = session && <SessionLocationPicker session={session} />

  // The server refuses a pick while the session is busy.
  if (session?.workingFolderDeleted && !running && !preparing) {
    // Outside the composer's keybinding area, so Enter picks the folder rather than sending.
    return (
      <ComposerFrame alert={alert} location={location} status={status}>
        <PickWorkingFolder session={session} />
      </ComposerFrame>
    )
  }

  const relaunchSheet = session && relaunchFailure && (
    <ActionSheet
      tone="danger"
      icon="circle-alert"
      title={relaunchFailureText(offered, session, relaunchFailure.previous)}
      note="Your message is back in the field."
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMenu({ open: true, start: changedRunOption(session, relaunchFailure.previous) })
            }
          >
            Pick another
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => changeRunOptions(relaunchFailure.previous)}
          >
            {goBackLabel(offered, session, relaunchFailure.previous)}
          </Button>
        </>
      }
      data-testid="composer-relaunch-failure"
    >
      {relaunchFailure.error !== null && (
        <Text as="p" size="xs" tone="muted" mono lines={3}>
          {relaunchFailure.error}
        </Text>
      )}
    </ActionSheet>
  )

  return (
    <ComposerFrame
      area="composer"
      alert={alert}
      sheets={
        session && (
          <>
            <Slot slot="composer.above" props={{ session, isEmptyComposer }} />
            <PendingSheet session={session} />
            {relaunchSheet}
          </>
        )
      }
      location={location}
      status={status}
      {...(session !== undefined && { announce: statusLabel(session.status) })}
    >
      <MessageField
        ref={field}
        sessionId={sessionId}
        label="Message"
        placeholder="Ask, build, or paste an image…"
        draft={draft}
        onDraftChange={setDraft}
        onRefusal={setRefusal}
        {...(completion && { completion })}
        footer={
          <Stack direction="row" align="end" justify="between" gap={2}>
            <Stack direction="row" align="center" gap={3}>
              {session && (
                <RunOptionsMenu
                  session={session}
                  offered={offered}
                  previous={relaunchFailure?.previous ?? null}
                  state={menu}
                  onStateChange={setMenu}
                  onChange={changeRunOptions}
                />
              )}
            </Stack>
            {running && text.trim() === "" ? (
              <IconButton
                icon="stop"
                label="Interrupt"
                tooltip={interruptHint}
                variant="secondary"
                onClick={interrupt}
              />
            ) : (
              <IconButton
                icon="send"
                label="Send"
                tooltip={sendHint}
                variant="primary"
                disabled={text.trim() === "" || preparing}
                onClick={submit}
              />
            )}
          </Stack>
        }
      />
    </ComposerFrame>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("session.composer", Composer, { name: "composer" })
})
