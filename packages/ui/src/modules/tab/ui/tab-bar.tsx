import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useState, type DragEvent, type KeyboardEvent } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { NewSessionButton } from "../../session/ui/new-session-button.tsx"
import { SessionMark } from "../../session/ui/session-mark.tsx"
import { statusLabel } from "../../session/rules/status-label.ts"
import { closeTabAtom } from "../atoms/close-tab.ts"
import { tabsOf } from "../atoms/list-tabs.ts"
import { openTabAtom } from "../atoms/open-tab.ts"
import { reorderTabsAtom } from "../atoms/reorder-tabs.ts"
import { moveTab } from "../rules/reorder.ts"
import "./tab-bar.css"

type Placement = "before" | "after"

function TabItem({
  projectPath,
  sessionId,
  selected,
  focusable,
  drop,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  projectPath: string
  sessionId: string
  selected: boolean
  focusable: boolean
  drop: Placement | undefined
  onDragStart: () => void
  onDragOver: (placement: Placement) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const openTab = useAtomSet(openTabAtom)
  const closeTab = useAtomSet(closeTabAtom)
  if (!session) return null

  const placementAt = (event: DragEvent<HTMLDivElement>): Placement => {
    const box = event.currentTarget.getBoundingClientRect()
    return event.clientX < box.left + box.width / 2 ? "before" : "after"
  }

  return (
    <div
      className="iv-tab-bar__item"
      role="presentation"
      draggable
      data-selected={selected || undefined}
      data-drop={drop}
      data-testid="tab"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", sessionId)
        onDragStart()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(placementAt(event))
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
      onMouseDown={(event) => {
        // Stops the browser's middle-click autoscroll.
        if (event.button === 1) event.preventDefault()
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return
        event.preventDefault()
        closeTab({ sessionId })
      }}
    >
      <button
        type="button"
        role="tab"
        className="iv-tab-bar__tab"
        aria-selected={selected}
        tabIndex={focusable ? 0 : -1}
        onClick={() => openTab({ sessionId })}
      >
        <SessionMark status={session.status} label={statusLabel(session.status)} />
        <span className="iv-tab-bar__title" data-testid="tab-title" title={session.title}>
          {session.title}
        </span>
      </button>
      <button
        type="button"
        className="iv-tab-bar__close"
        aria-label={`Close ${session.title}`}
        onClick={() => closeTab({ sessionId })}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
  const target =
    event.key === "ArrowLeft"
      ? current - 1
      : event.key === "ArrowRight"
        ? current + 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : -1
  const next = tabs[target]
  if (current < 0 || next === undefined || target === current) return
  event.preventDefault()
  next.focus()
  next.click()
}

export function TabBar({ projectPath }: { projectPath: string }) {
  useAtomMount(sessionsOf(projectPath).ids)
  const { tabs, selectedSessionId } = useAtomValue(tabsOf(projectPath).value)
  const reorder = useAtomSet(reorderTabsAtom)
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; placement: Placement } | null>(null)

  const end = () => {
    setDragged(null)
    setOver(null)
  }

  const drop = () => {
    if (dragged !== null && over !== null) {
      const ids = tabs.map((tab) => tab.sessionId)
      const next = moveTab(ids, dragged, over.id, over.placement)
      if (next.some((id, index) => id !== ids[index])) {
        reorder({ projectPath, sessionIds: next })
      }
    }
    end()
  }

  const focusableId = selectedSessionId ?? tabs[0]?.sessionId

  return (
    <div className="iv-tab-bar">
      <div
        className="iv-tab-bar__list"
        role="tablist"
        aria-label="Open sessions"
        onKeyDown={moveFocus}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.sessionId}
            projectPath={projectPath}
            sessionId={tab.sessionId}
            selected={tab.sessionId === selectedSessionId}
            focusable={tab.sessionId === focusableId}
            drop={
              over?.id === tab.sessionId && dragged !== tab.sessionId ? over.placement : undefined
            }
            onDragStart={() => setDragged(tab.sessionId)}
            onDragOver={(placement) => {
              if (dragged !== null) setOver({ id: tab.sessionId, placement })
            }}
            onDrop={drop}
            onDragEnd={end}
          />
        ))}
      </div>
      <NewSessionButton projectPath={projectPath} icon="plus" size="sm" />
    </div>
  )
}
