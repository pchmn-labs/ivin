import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { useRef, useState } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { ClaudeMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { TextArea } from "../../../core/components/text-field/text-field.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { isRunning } from "../rules/is-running.ts"
import { sendMessageFailure } from "../rules/failure-message.ts"
import { statusLabel } from "../rules/status-label.ts"
import { sendMessageAtom } from "../atoms/send-message.ts"
import "./composer.css"

export function Composer({
  projectPath,
  sessionId,
  placeholder = "Message Claude",
}: {
  projectPath: string
  sessionId: string
  placeholder?: string
}) {
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

  return (
    <div className="iv-composer" ref={root} data-keybinding-area="composer">
      {failure && (
        <div className="iv-composer__alert" data-testid="composer-alert">
          <ErrorMessage
            message={failure.text}
            {...(failure.retryable && { onRetry: () => sendText(failure.message) })}
          />
        </div>
      )}
      {session && <Slot slot="composer.above" props={{ session, isEmptyComposer }} />}
      <div className="iv-composer__surface">
        <TextArea
          label="Message"
          placeholder={placeholder}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Stack direction="row" align="center" gap={3}>
            {session && (
              <span className="iv-composer__model" data-testid="composer-model">
                <ClaudeMark size={14} />
                {session.model}
              </span>
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
      <div className="iv-composer__statusline">
        {session && <Location session={session} choosing={choosing} />}
        <div className="iv-composer__status-slot" data-testid="composer-status">
          <Slot slot="composer.status" props={{ sessionId }} />
        </div>
      </div>
    </div>
  )
}

// Outside a git repository there is nothing to choose.
function Location({ session, choosing }: { session: Session; choosing: boolean }) {
  const location = useSessionLocation(session)
  return choosing && location.kind !== "folder" ? (
    <WorkingFolderPicker session={session} />
  ) : (
    <SessionLocation location={location} title={session.workingFolder} />
  )
}
