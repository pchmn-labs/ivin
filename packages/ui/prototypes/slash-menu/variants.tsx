import { useEffect, useRef } from "react"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { COMMANDS } from "./data.ts"
import { Matched, type MenuProps } from "./scene.tsx"

const HINTS = "↑↓ to move · ↩ or tab to pick · esc to close"

function useActiveInView(active: number) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])
  return list
}

function Tag({ kind }: { kind: "skill" | "command" }) {
  return <span className="proto-tag">{kind === "skill" ? "Skill" : "Command"}</span>
}

// The loading, no match and failed states every variant shows in place of its list.
function Status({ state, query, onRetry }: Pick<MenuProps, "state" | "query" | "onRetry">) {
  if (state === "loading")
    return (
      <div className="proto-status">
        <Icon name="loader" size={14} />
        Loading Claude's skills and commands…
      </div>
    )
  if (state === "failed")
    return (
      <div className="proto-status" data-tone="danger">
        <Icon name="circle-alert" size={14} />
        <span className="proto-status-text">
          Could not load Claude's skills and commands. ↩ still sends the message.
        </span>
        <button type="button" className="proto-retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  return (
    <div className="proto-status">
      <span className="proto-status-text">
        No skill or command matches <code>/{query}</code>. ↩ sends the message as typed.
      </span>
    </div>
  )
}

const listProps = { id: "proto-slash-list", role: "listbox", "aria-label": "Skills and commands" }

export function OneLine({ state, query, items, active, onHover, onPick, onRetry }: MenuProps) {
  const list = useActiveInView(active)
  const highlighted = items[active]?.command
  return (
    <div className="proto-v1">
      {items.length === 0 ? (
        <Status state={state} query={query} onRetry={onRetry} />
      ) : (
        <>
          <div className="proto-v1-list" ref={list} {...listProps}>
            {items.map(({ command, matched }, i) => (
              <div
                key={command.name}
                className="proto-v1-row"
                role="option"
                aria-selected={i === active}
                data-index={i}
                data-active={i === active ? "" : undefined}
                onMouseMove={() => onHover(i)}
                onClick={() => onPick(command.name)}
              >
                <span className="proto-name">
                  <span className="proto-slash">/</span>
                  <Matched name={command.name} at={matched} />
                </span>
                {command.argumentHint && <span className="proto-hint">{command.argumentHint}</span>}
                <Tag kind={command.kind} />
              </div>
            ))}
          </div>
          <div className="proto-v1-footer">
            <p className="proto-v1-description">{highlighted?.description}</p>
            <span className="proto-keys">{HINTS}</span>
          </div>
        </>
      )}
    </div>
  )
}

export function Sheet({ state, query, items, active, onHover, onPick, onRetry }: MenuProps) {
  const list = useActiveInView(active)
  return (
    <div className="proto-v2">
      <div className="proto-v2-head">
        <span>Skills and commands</span>
        <span className="proto-keys">{HINTS}</span>
      </div>
      {items.length === 0 ? (
        <Status state={state} query={query} onRetry={onRetry} />
      ) : (
        <div className="proto-v2-list" ref={list} {...listProps}>
          {items.map(({ command, matched }, i) => (
            <div
              key={command.name}
              className="proto-v2-row"
              role="option"
              aria-selected={i === active}
              data-index={i}
              data-active={i === active ? "" : undefined}
              onMouseMove={() => onHover(i)}
              onClick={() => onPick(command.name)}
            >
              <div className="proto-v2-line">
                <span className="proto-name">
                  <span className="proto-slash">/</span>
                  <Matched name={command.name} at={matched} />
                </span>
                {command.argumentHint && <span className="proto-hint">{command.argumentHint}</span>}
                <Tag kind={command.kind} />
              </div>
              <p className="proto-v2-description">{command.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Preview({ state, query, items, active, onHover, onPick, onRetry }: MenuProps) {
  const list = useActiveInView(active)
  const highlighted = items[active]?.command
  return (
    <div className="proto-v3">
      {items.length === 0 || !highlighted ? (
        <Status state={state} query={query} onRetry={onRetry} />
      ) : (
        <>
          <div className="proto-v3-body">
            <div className="proto-v3-list" ref={list} {...listProps}>
              {items.map(({ command, matched }, i) => (
                <div
                  key={command.name}
                  className="proto-v3-row"
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  data-active={i === active ? "" : undefined}
                  onMouseMove={() => onHover(i)}
                  onClick={() => onPick(command.name)}
                >
                  <span className="proto-v3-kind" data-kind={command.kind}>
                    <Icon name={command.kind === "skill" ? "sparkles" : "terminal"} size={14} />
                  </span>
                  <span className="proto-name">
                    <span className="proto-slash">/</span>
                    <Matched name={command.name} at={matched} />
                  </span>
                </div>
              ))}
            </div>
            <div className="proto-v3-detail">
              <div className="proto-v3-title">
                <span className="proto-name">/{highlighted.name}</span>
                <Tag kind={highlighted.kind} />
              </div>
              {highlighted.argumentHint && (
                <code className="proto-v3-usage">
                  /{highlighted.name} {highlighted.argumentHint}
                </code>
              )}
              <p className="proto-v3-description">{highlighted.description}</p>
            </div>
          </div>
          <div className="proto-v3-footer">
            <span className="proto-keys">{HINTS}</span>
            <span>
              {items.length} of {COMMANDS.length}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
