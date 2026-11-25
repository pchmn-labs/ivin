import { useEffect, useRef, useState, type ComponentType } from "react"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { COMMANDS, rank, slashQuery, withPick, type Ranked } from "./data.ts"

export type ListState = "loaded" | "loading" | "failed"

export interface MenuProps {
  readonly state: ListState
  readonly query: string
  readonly items: ReadonlyArray<Ranked>
  readonly active: number
  readonly onHover: (index: number) => void
  readonly onPick: (name: string) => void
  readonly onRetry: () => void
}

export interface Variant {
  // `popup` floats above the field's left edge; `docked` joins the field's top edge, full width.
  readonly placement: "popup" | "docked"
  readonly Menu: ComponentType<MenuProps>
}

export function Matched({ name, at }: { name: string; at: ReadonlyArray<number> }) {
  const marked = new Set(at)
  return (
    <>
      {Array.from(name, (letter, i) =>
        marked.has(i) ? (
          <mark key={i} className="proto-match">
            {letter}
          </mark>
        ) : (
          letter
        ),
      )}
    </>
  )
}

const SCENARIOS: ReadonlyArray<{ id: ListState; label: string }> = [
  { id: "loaded", label: "Listed" },
  { id: "loading", label: "Loading" },
  { id: "failed", label: "Failed" },
]

const EARLIER = [
  { from: "user", text: "The session list jumps when a session ends. Can you find why?" },
  {
    from: "agent",
    text: "The list re-sorts on every status change, so the row moves under the pointer. I kept the order stable while the pointer is over the list and added a test for it.",
  },
] as const

export function Scene({ variant }: { variant: Variant }) {
  const { placement, Menu } = variant
  const field = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")
  const [caret, setCaret] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [scenario, setScenario] = useState<ListState>("loaded")
  const [state, setState] = useState<ListState>("loaded")
  const [sent, setSent] = useState<ReadonlyArray<string>>([])

  const query = slashQuery(text, caret)
  const open = query !== null && dismissed !== text
  const items = open && state === "loaded" ? rank(COMMANDS, query) : []

  useEffect(() => setActive(0), [query])
  useEffect(() => field.current?.focus(), [])

  const chooseScenario = (next: ListState) => {
    setScenario(next)
    setState(next)
    field.current?.focus()
  }

  const retry = () => {
    setState("loading")
    setTimeout(() => setState("loaded"), 900)
    field.current?.focus()
  }

  const update = (value: string, at: number) => {
    setText(value)
    setCaret(at)
  }

  const pick = (name: string) => {
    const next = withPick(text, name)
    const at = name.length + 2
    setText(next)
    setCaret(at)
    setDismissed(next)
    requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(at, at)
    })
  }

  const send = () => {
    if (text.trim() === "") return
    setSent((list) => [...list, text.trim()])
    setText("")
    setCaret(0)
    setDismissed(null)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && items.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const step = event.key === "ArrowDown" ? 1 : -1
        setActive((i) => (i + step + items.length) % items.length)
        return
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault()
        pick(items[active]?.command.name ?? "")
        return
      }
    }
    if (open && event.key === "Escape") {
      event.preventDefault()
      setDismissed(text)
      return
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  const menu = open && (
    <div
      className="proto-menu-anchor"
      data-placement={placement}
      // Keeps the focus in the field when a row is clicked.
      onMouseDown={(event) => event.preventDefault()}
    >
      <Menu
        state={state}
        query={query}
        items={items}
        active={active}
        onHover={setActive}
        onPick={pick}
        onRetry={retry}
      />
    </div>
  )

  return (
    <div className="proto-app">
      <div className="proto-scenarios" role="group" aria-label="Command list">
        <span>Command list</span>
        {SCENARIOS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-active={scenario === id ? "" : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseScenario(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <main className="proto-main">
        <div className="proto-transcript">
          {[...EARLIER, ...sent.map((t) => ({ from: "user", text: t }) as const)].map(
            (message, i) => (
              <p key={i} className="proto-message" data-from={message.from}>
                {message.text}
              </p>
            ),
          )}
        </div>
        <div className="proto-composer">
          <div className="proto-field-wrap">
            {menu}
            <div className="proto-field" data-menu={open ? placement : undefined}>
              <textarea
                ref={field}
                aria-label="Message"
                placeholder="Ask, build, or paste an image…"
                rows={2}
                value={text}
                onChange={(event) => update(event.target.value, event.target.selectionStart)}
                onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
                onKeyDown={onKeyDown}
                aria-expanded={open}
                aria-controls="proto-slash-list"
                aria-autocomplete="list"
              />
              <div className="proto-field-footer">
                <button type="button" className="proto-run-options">
                  Opus 5.5 · High <Icon name="chevron-down" size={14} />
                </button>
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
          </div>
          <div className="proto-statusline">
            <span>
              <Icon name="folder" size={14} /> ivin
            </span>
            <span className="proto-branch">
              <Icon name="git-branch" size={14} /> main
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
