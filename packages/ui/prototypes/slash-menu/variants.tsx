import { useEffect, useRef } from "react"
import { Icon } from "../../src/core/components/icon/icon.tsx"
import { SOURCE_LABEL, type AgentCommand } from "./data.ts"
import { Matched, type MenuProps } from "./scene.tsx"
import type { Ranked } from "./data.ts"

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

function Source({ command }: { command: AgentCommand }) {
  if (command.source === null) return null
  return <span className="proto-source">{SOURCE_LABEL[command.source]}</span>
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

export type SourceStyle = "label" | "tag" | "groups"

const groupOf = (command: AgentCommand) => command.source ?? "command"
const GROUP_LABEL = {
  project: "Project skills",
  user: "User skills",
  plugin: "Plugin skills",
  "built-in": "Built-in skills",
  command: "Claude's commands",
} as const

// Rows grouped by where they come from, each group where its best match ranks.
export const bySource = (items: ReadonlyArray<Ranked>): ReadonlyArray<Ranked> => {
  const groups = new Map<string, Ranked[]>()
  for (const item of items) {
    const key = groupOf(item.command)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.values()].flat()
}

function SheetTag({ command, style }: { command: AgentCommand; style: SourceStyle }) {
  if (style === "groups") return null
  if (style === "label")
    return (
      <>
        <Source command={command} />
        <Tag kind={command.kind} />
      </>
    )
  return (
    <span className="proto-tag">
      {command.source === null ? "Command" : `${SOURCE_LABEL[command.source]} skill`}
    </span>
  )
}

export const sheet = (style: SourceStyle) =>
  function Sheet({ state, query, items, active, onHover, onPick, onRetry }: MenuProps) {
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
            {items.map(({ command, matched }, i) => {
              const group = groupOf(command)
              const heading =
                style === "groups" && (i === 0 || groupOf(items[i - 1].command) !== group)
              return (
                <div key={command.name} role="presentation">
                  {heading && <div className="proto-v2-group">{GROUP_LABEL[group]}</div>}
                  <div
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
                      {command.argumentHint && (
                        <span className="proto-hint">{command.argumentHint}</span>
                      )}
                      <SheetTag command={command} style={style} />
                    </div>
                    <p className="proto-v2-description">{command.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
