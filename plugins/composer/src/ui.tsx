import { useEffect, useRef, useState } from "react"
import {
  ActionSheet,
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
import { pendingText, withRelaunchMessage, withUnreadMessages } from "./rules/draft.ts"
import { changedRunOption, goBackLabel, relaunchFailureText } from "./rules/relaunch-failure.ts"

const EMPTY_DRAFT: Draft = { text: "", images: [] }

function PendingSheet({ session }: { session: Session }) {
  const sendNow = useSendNow(session.id)
  const pending = session.pendingMessages
  if (pending.length === 0) return null
  return (
    <ActionSheet
      icon="clock"
      title={
        pending.length === 1 ? "Sent to the agent" : `${pending.length} messages sent to the agent`
      }
      note={`Read once the agent's current tool call or turn ends. Stop puts ${pending.length === 1 ? "it" : "them"} back here.`}
      actions={
        <Tooltip content="Stops this turn and sends your messages">
          <Button variant="ghost" size="sm" onClick={sendNow}>
            Send now
          </Button>
        </Tooltip>
      }
      data-testid="composer-pending"
    >
      <Stack as="ul" gap={1}>
        {pending.map((message) => (
          <Stack as="li" key={message.id}>
            <Text size="sm" truncate title={message.text}>
              {pendingText(message)}
            </Text>
          </Stack>
        ))}
      </Stack>
    </ActionSheet>
  )
}

function Composer({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useDraft(sessionId)
  const text = draft.text
  const field = useRef<MessageFieldHandle>(null)
  const [failure, setFailure] = useState<(ActionFailure & { draft: Draft }) | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const send = useSendMessage(sessionId)
  const interrupt = useInterruptSession(sessionId)
  const session = useSession(sessionId)
  const running = session?.status === "working" || session?.status === "waiting"
  const preparing = session?.status === "preparing_worktree"
  const setRunOptions = useSetRunOptions(sessionId)
  const offered = useOfferedRunOptions(sessionId)
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

  const unreadText = (session?.unreadMessages ?? []).map((message) => message.text).join("\n\n")
  useEffect(() => {
    // Runs again on each mount, so a draft that already holds the messages keeps them once.
    if (unreadText !== "") setDraft((current) => withUnreadMessages(current, unreadText))
  }, [unreadText])

  const changeRunOptions = (options: Partial<RunOptions>) => {
    setOptionsFailure(null)
    void setRunOptions(options).then((failed) => {
      if (failed !== undefined) setOptionsFailure({ options, ...failed })
    })
  }

  const sendDraft = (sent: Draft) => {
    if (preparing) return
    setFailure(null)
    setRefusal(null)
    setDraft((current) => (current.text === sent.text ? EMPTY_DRAFT : current))
    void send(sent).then((failed) => {
      if (failed === undefined) return
      // Text typed since the send is newer than the failed message, so it wins.
      setDraft((current) => (current.text === "" ? sent : current))
      setFailure({ draft: sent, ...failed })
    })
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
    ? {
        message: failure.text,
        ...(failure.retryable && { onRetry: () => sendDraft(failure.draft) }),
      }
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

  if (session?.workingFolderDeleted) {
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
                icon="square"
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
