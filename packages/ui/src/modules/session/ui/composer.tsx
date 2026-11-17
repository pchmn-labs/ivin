import { useAtomSet } from "@effect/atom-react"
import { Exit } from "effect"
import { useState } from "react"
import { sendMessageAtom } from "../atoms/send-message.ts"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [text, setText] = useState("")
  const [failed, setFailed] = useState(false)
  const send = useAtomSet(sendMessageAtom, { mode: "promiseExit" })

  const submit = () => {
    if (text.trim() === "") return
    setFailed(false)
    void send({ projectPath, sessionId, text }).then((exit) => setFailed(Exit.isFailure(exit)))
    setText("")
  }

  return (
    <div>
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
    </div>
  )
}
