import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { RunOption, RunOptions, Session } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useRef, useState } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { ActionSheet } from "../../../core/components/action-sheet/action-sheet.tsx"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import {
  ErrorMessage,
  type ErrorMessageProps,
} from "../../../core/components/error-message/error-message.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { TextArea } from "../../../core/components/text-field/text-field.tsx"
import { BranchPicker } from "./branch-picker.tsx"
import { RunOptionsMenu, type RunOptionsMenuState } from "./run-options-menu.tsx"
import { getHarnessAtom } from "../../server/atoms/get-harness.ts"
import { PickWorkingFolder } from "./pick-working-folder.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { RUN_OPTIONS, goBackLabel, relaunchFailureText } from "../rules/run-options.ts"
import { setRunOptionsAtom } from "../atoms/set-run-options.ts"
import { isRunning } from "../rules/is-running.ts"
import { sendMessageFailure, setRunOptionsFailure } from "../rules/failure-message.ts"
import { statusLabel } from "../rules/status-label.ts"
import { sendMessageAtom } from "../atoms/send-message.ts"
import "./composer.css"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [text, setText] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const [failure, setFailure] = useState<(ActionFailure & { message: string }) | null>(null)
  const choice = useAtomValue(workingFolderChoiceOf(sessionId))
  const send = useAtomSet(sendMessageAtom, { mode: "promiseExit" })
  const interrupt = useAtomSet(interruptSessionAtom)
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const running = isRunning(session?.status)
  const preparing = session?.status === "preparing_worktree"
  const choosing = session !== undefined && !session.started && !preparing
  const harness = session && HARNESSES[session.harness]
  const setRunOptions = useAtomSet(setRunOptionsAtom, { mode: "promiseExit" })
  const [optionsFailure, setOptionsFailure] = useState<
    (ActionFailure & { options: Partial<RunOptions> }) | null
  >(null)
  const relaunchFailure = session?.relaunchFailure ?? null
  const relaunchFailureKey = relaunchFailure && JSON.stringify(relaunchFailure)
  const [menu, setMenu] = useState<RunOptionsMenuState>({ open: false, start: "model" })
  const harnessInfo = AsyncResult.getOrElse(useAtomValue(getHarnessAtom), () => null)
  const offered = session && harnessInfo?.id === session.harness ? harnessInfo.runOptions : null

  useEffect(() => {
    if (relaunchFailure === null) return
    setText((current) => (current === "" ? relaunchFailure.message : current))
  }, [relaunchFailureKey])

  const changeRunOptions = (options: Partial<RunOptions>) => {
    setOptionsFailure(null)
    void setRunOptions({ projectPath, sessionId, options }).then((exit) => {
      if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
      setOptionsFailure({ options, ...setRunOptionsFailure(Cause.squash(exit.cause), options) })
    })
  }

  const sendText = (message: string) => {
    if (preparing) return
    setFailure(null)
    setText((current) => (current === message ? "" : current))
    const workingFolder = choosing ? choice : undefined
    void send({
      projectPath,
      sessionId,
      text: message,
      ...(workingFolder && { workingFolder }),
    }).then((exit) => {
      if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
      // Text typed since the send is newer than the failed message, so it wins.
      setText((current) => (current === "" ? message : current))
      setFailure({ message, ...sendMessageFailure(Cause.squash(exit.cause)) })
    })
  }
  const submit = () => {
    if (text.trim() !== "") sendText(text)
  }
  useCommandHandler("composer.send", submit)
  const sendHint = useKeyHint("Send", "composer.send")
  const interruptHint = useKeyHint("Interrupt", "session.interrupt")

  const isEmptyComposer = (target: EventTarget | null) =>
    text === "" &&
    target instanceof HTMLTextAreaElement &&
    target.closest(".iv-composer") === root.current

  const shown: ErrorMessageProps | null = failure
    ? {
        message: failure.text,
        ...(failure.retryable && { onRetry: () => sendText(failure.message) }),
      }
    : optionsFailure
      ? {
          message: optionsFailure.text,
          ...(optionsFailure.retryable && {
            onRetry: () => changeRunOptions(optionsFailure.options),
          }),
        }
      : null
  const changed: RunOption =
    (relaunchFailure &&
      RUN_OPTIONS.find((option) => session?.[option] !== relaunchFailure.previous[option])) ??
    "model"
  const relaunchSheet = session && relaunchFailure && (
    <ActionSheet
      tone="danger"
      icon="circle-alert"
      title={relaunchFailureText(offered, session, relaunchFailure.previous)}
      data-testid="composer-relaunch-failure"
    >
      <div className="iv-composer__sheet-row">
        <span className="iv-composer__sheet-hint">Your message is back in the field.</span>
        <Button variant="ghost" size="sm" onClick={() => setMenu({ open: true, start: changed })}>
          Pick another
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => changeRunOptions(relaunchFailure.previous)}
        >
          {goBackLabel(offered, session, relaunchFailure.previous)}
        </Button>
      </div>
    </ActionSheet>
  )
  const alert = shown && (
    <div className="iv-composer__alert" data-testid="composer-alert">
      <ErrorMessage {...shown} />
    </div>
  )
  const statusLine = (
    <div className="iv-composer__statusline">
      {session && <StatusLocation session={session} choosing={choosing} />}
      <div className="iv-composer__status-slot" data-testid="composer-status">
        <Slot slot="composer.status" props={{ sessionId }} />
      </div>
    </div>
  )

  if (session?.workingFolderDeleted) {
    // Outside the composer's keybinding area, so Enter picks the folder rather than sending.
    return (
      <div className="iv-composer">
        {alert}
        <PickWorkingFolder session={session} />
        {statusLine}
      </div>
    )
  }

  return (
    <div className="iv-composer" ref={root} data-keybinding-area="composer">
      {alert}
      {session && <Slot slot="composer.above" props={{ session, isEmptyComposer }} />}
      {relaunchSheet}
      <div className="iv-composer__surface">
        <TextArea
          label="Message"
          placeholder={`Message ${harness?.name ?? "the agent"}`}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Stack direction="row" align="center" gap={3}>
            {session && (
              <RunOptionsMenu
                session={session}
                previous={relaunchFailure?.previous ?? null}
                state={menu}
                onStateChange={setMenu}
                onChange={changeRunOptions}
              />
            )}
          </Stack>
          {session && (
            // The state shows on the session mark; screen readers hear it from here.
            <span
              className="iv-visually-hidden"
              role="status"
              data-testid="composer-session-status"
            >
              {statusLabel(session.status)}
            </span>
          )}
          {/* A working session with an empty field offers Stop; typed text can still be sent. */}
          {running && text.trim() === "" ? (
            <IconButton
              icon="square"
              label="Interrupt"
              tooltip={interruptHint}
              variant="secondary"
              onClick={() => interrupt({ projectPath, sessionId })}
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
      </div>
      {statusLine}
    </div>
  )
}

function StatusLocation({ session, choosing }: { session: Session; choosing: boolean }) {
  const location = useSessionLocation(session)
  // Outside a git repository there is nothing to choose.
  return choosing && location.kind !== "folder" ? (
    <WorkingFolderPicker session={session} location={location} />
  ) : (
    <SessionLocation
      location={location}
      title={session.workingFolder}
      {...(location.branch !== null &&
        location.deleted !== true && {
          branch: <BranchPicker session={session} branch={location.branch} />,
        })}
    />
  )
}
