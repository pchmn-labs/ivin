import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Exit } from "effect"
import { useRef, useState } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { Button } from "../../../core/components/button/button.tsx"
import { ClaudeMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { StatusMark } from "../../../core/components/status-mark/status-mark.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { TextArea } from "../../../core/components/text-field/text-field.tsx"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { isRunning } from "../rules/is-running.ts"
import { statusLabel } from "../rules/status-label.ts"
import { sendMessageAtom } from "../atoms/send-message.ts"
import "./composer.css"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [text, setText] = useState("")
  const root = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const send = useAtomSet(sendMessageAtom, { mode: "promiseExit" })
  const interrupt = useAtomSet(interruptSessionAtom)
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const running = isRunning(session?.status)

  const submit = () => {
    if (text.trim() === "") return
    setFailed(false)
    void send({ projectPath, sessionId, text }).then((exit) => setFailed(Exit.isFailure(exit)))
    setText("")
  }

  const isEmptyComposer = (target: EventTarget | null) =>
    text === "" &&
    target instanceof HTMLTextAreaElement &&
    target.closest(".iv-composer") === root.current

  return (
    <div className="iv-composer" ref={root}>
      {failed && (
        <div className="iv-composer__alert">
          <Text role="alert" tone="danger">
            The message was not sent
          </Text>
        </div>
      )}
      {session && <Slot slot="composer.above" props={{ session, isEmptyComposer }} />}
      <div className="iv-composer__surface">
        <TextArea
          label="Message"
          placeholder="Message Claude"
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            submit()
          }}
        />
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Stack direction="row" align="center" gap={3}>
            {session && (
              <span className="iv-composer__model" data-testid="composer-model">
                <ClaudeMark size={14} />
                {session.model}
              </span>
            )}
            {session && (
              <span data-testid="composer-session-status">
                <StatusMark status={session.status} label={statusLabel(session.status)} showLabel />
              </span>
            )}
            <div data-testid="composer-status">
              <Slot slot="composer.status" props={{ sessionId }} />
            </div>
          </Stack>
          <Stack direction="row" align="center" gap={2}>
            {running && (
              <Button icon="square" onClick={() => interrupt({ projectPath, sessionId })}>
                Interrupt
              </Button>
            )}
            <Button variant="primary" icon="send" onClick={submit}>
              Send
            </Button>
          </Stack>
        </Stack>
      </div>
    </div>
  )
}
