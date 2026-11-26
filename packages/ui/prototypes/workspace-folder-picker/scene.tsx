import { useState, type ComponentType } from "react"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { FOLDERS, WORKSPACE, type Choice } from "./data.ts"

export interface LocationProps {
  readonly choice: Choice
  readonly onChoose: (choice: Choice) => void
  // After the first message the location is shown, no longer picked.
  readonly started: boolean
}

export function Scene({ Location }: { Location: ComponentType<LocationProps> }) {
  const [choice, setChoice] = useState<Choice>({ kind: "new" })
  const [text, setText] = useState("")
  const [sent, setSent] = useState<string | null>(null)

  const send = () => {
    if (text.trim() === "") return
    setSent(text.trim())
    setText("")
  }

  return (
    <div className="proto-app">
      <aside className="proto-sidebar">
        <div className="proto-project">
          <Icon name="folder" size={14} />
          {WORKSPACE}
        </div>
        <div className="proto-session" data-active="">
          {sent ?? "New session"}
        </div>
        <div className="proto-session">Fix the cart total rounding</div>
        <div className="proto-session">Search by SKU</div>
      </aside>
      <main className="proto-main">
        <div className="proto-transcript">
          {sent === null ? (
            <p className="proto-empty">
              A session on {WORKSPACE}: {FOLDERS.map((f) => f.name).join(", ")}.
            </p>
          ) : (
            <div className="proto-bubble">{sent}</div>
          )}
        </div>
        <div className="proto-composer">
          <div className="proto-field">
            <textarea
              value={text}
              placeholder="Ask, build, or paste an image…"
              rows={2}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
            />
            <div className="proto-field__row">
              <span className="proto-options">
                Opus 5.5 · High · Manual
                <Icon name="chevron-down" size={12} />
              </span>
              <button
                type="button"
                className="proto-send"
                aria-label="Send"
                disabled={text.trim() === ""}
                onClick={send}
              >
                <Icon name="send" size={14} />
              </button>
            </div>
          </div>
          <div className="proto-statusline">
            <Location choice={choice} onChoose={setChoice} started={sent !== null} />
            <span className="proto-usage">12% · 5h</span>
          </div>
        </div>
      </main>
    </div>
  )
}
