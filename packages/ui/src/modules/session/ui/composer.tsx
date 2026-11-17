import { useAtom } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import { sendMessageAtom } from "../atoms/send-message.ts"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [text, setText] = useState("")
  const [sent, send] = useAtom(sendMessageAtom)

  const submit = () => {
    if (text.trim() === "") return
    send({ projectPath, sessionId, text })
    setText("")
  }

  return (
    <div>
      {AsyncResult.isFailure(sent) && <p role="alert">The message was not sent</p>}
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
