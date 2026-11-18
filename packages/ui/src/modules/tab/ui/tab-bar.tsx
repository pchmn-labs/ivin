import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useState, type DragEvent } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { SessionMark } from "../../session/ui/session-mark.tsx"
import { statusLabel } from "../../session/rules/status-label.ts"
import { closeTabAtom } from "../atoms/close-tab.ts"
import { tabsOf } from "../atoms/list-tabs.ts"
import { openTabAtom } from "../atoms/open-tab.ts"
import { reorderTabsAtom } from "../atoms/reorder-tabs.ts"
import { moveTab } from "../rules/reorder-tabs.ts"
import "./tab-bar.css"

type Placement = "before" | "after"

function TabItem({
  projectPath,
  sessionId,
  selected,
  drop,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  projectPath: string
  sessionId: string
  selected: boolean
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
      data-attention={session.status === "waiting" || undefined}
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
    >
      <button
        type="button"
        role="tab"
        className="iv-tab-bar__tab"
        aria-selected={selected}
        onClick={() => openTab({ sessionId })}
      >
        <SessionMark status={session.status} label={statusLabel(session.status)} />
        <span className="iv-tab-bar__title" data-testid="tab-title">
          {session.title}
        </span>
      </button>
      <IconButton
        icon="x"
        label={`Close ${session.title}`}
        size="sm"
        onClick={() => closeTab({ sessionId })}
      />
    </div>
  )
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

  return (
    <div className="iv-tab-bar" role="tablist" aria-label="Open sessions">
      {tabs.map((tab) => (
        <TabItem
          key={tab.sessionId}
          projectPath={projectPath}
          sessionId={tab.sessionId}
          selected={tab.sessionId === selectedSessionId}
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
  )
}
