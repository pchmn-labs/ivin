import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Exit } from "effect"
import { useState } from "react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { isRunning } from "../rules/is-running.ts"
import { statusLabel } from "../rules/status-label.ts"
import { sendMessageAtom } from "../atoms/send-message.ts"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [text, setText] = useState("")
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

  return (
    <div>
      {session && (
        <p data-testid="composer-session-status" style={{ margin: 0 }}>
          {statusLabel(session.status)}
        </p>
      )}
      {failed && <p role="alert">The message was not sent</p>}
      <textarea
        aria-label="Message"
        rows={3}
        style={{ width: "100%", boxSizing: "border-box" }}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
          event.preventDefault()
          submit()
        }}
      />
      <button type="button" onClick={submit}>
        Send
      </button>
      {running && (
        <button type="button" onClick={() => interrupt({ projectPath, sessionId })}>
          Interrupt
        </button>
      )}
      <div data-testid="composer-status">
        <Slot slot="composer.status" props={{ sessionId }} />
      </div>
    </div>
  )
}
