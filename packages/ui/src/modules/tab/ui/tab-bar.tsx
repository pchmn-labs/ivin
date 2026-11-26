import { RegistryContext, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useContext, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { ContextMenu } from "../../../core/components/menu/menu.tsx"
import { useCommandHandler, useCommandHandlers } from "../../command/hooks/use-command-handler.ts"
import { unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { fileName } from "../../file/rules/file-name.ts"
import { settingsAtom } from "../../setting/atoms/settings.ts"
import { useWindowLayout } from "../../setting/hooks/use-window-layout.ts"
import { isAgentBusy } from "../../session/rules/is-running.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { useStartSession } from "../../session/hooks/use-start-session.ts"
import { useSessionActions } from "../../session/hooks/use-session-actions.ts"
import { NewSessionButton } from "../../session/ui/new-session-button.tsx"
import { SessionCardTrigger } from "../../session/ui/session-card.tsx"
import { SessionMark } from "../../session/ui/session-mark.tsx"
import { Slot } from "../../../app/slot-renderer.tsx"
import { closeTabAtom } from "../atoms/close-tab.ts"
import { tabsOf } from "../atoms/list-tabs.ts"
import { openTabAtom } from "../atoms/open-tab.ts"
import { reorderTabsAtom } from "../atoms/reorder-tabs.ts"
import { moveBy, moveTab } from "../rules/reorder.ts"
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
  const { tabs: settings } = useAtomValue(settingsAtom)
  const [confirming, setConfirming] = useState(false)
  // Read when the user closes, kept while the prompt fades out.
  const [unsaved, setUnsaved] = useState<ReadonlyArray<string>>([])
  const registry = useContext(RegistryContext)
  const actions = useSessionActions(session, false)
  const item = useRef<HTMLDivElement>(null)
  const present = session !== undefined
  useEffect(() => {
    if (selected && present) item.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [selected, present])
  const stopsAgent = settings.stopAgentOnClose && isAgentBusy(session?.status)
  const requestClose = () => {
    if (!session) return
    const paths = registry.get(unsavedPathsOf(sessionId, session.workingFolder))
    setUnsaved(paths)
    if (stopsAgent || paths.length > 0) setConfirming(true)
    else closeTab({ projectPath, sessionId })
  }
  useCommandHandler("tab.close", requestClose, selected && present)
  if (!session) return null

  const unsavedNames = unsaved.map(fileName)
  const unsavedText =
    unsavedNames.length === 1
      ? `${unsavedNames[0]} has unsaved edits, which are lost.`
      : `${unsavedNames.length} files have unsaved edits, which are lost: ${unsavedNames.join(", ")}.`
  const prompt =
    unsaved.length === 0
      ? {
          title: "Close the tab and stop its agent?",
          description: `The agent of “${session.title}” is still running. The session stays under Inactive sessions.`,
          confirm: "Stop and close",
        }
      : {
          title: `Close “${session.title}” without saving its files?`,
          description: stopsAgent
            ? `${unsavedText} Its agent is still running and stops too.`
            : unsavedText,
          confirm: "Close without saving",
        }

  const placementAt = (event: DragEvent<HTMLDivElement>): Placement => {
    const box = event.currentTarget.getBoundingClientRect()
    return event.clientX < box.left + box.width / 2 ? "before" : "after"
  }

  return (
    <>
      <SessionCardTrigger session={session} place="tab">
        <ContextMenu items={actions.items}>
          <div
            ref={item}
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
              requestClose()
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
              <SessionMark
                status={session.status}
                waitingFor={session.waitingFor}
                harness={session.harness}
                tasks={session.backgroundTasks}
              />
              <span className="iv-tab-bar__title" data-testid="tab-title" title={session.title}>
                {session.title}
              </span>
              <span className="iv-tab-bar__badge">
                <Slot slot="session.badge" props={{ session }} />
              </span>
            </button>
            <button
              type="button"
              className="iv-tab-bar__close"
              tabIndex={-1}
              aria-hidden
              aria-label={`Close ${session.title}`}
              data-testid="tab-close"
              onClick={requestClose}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </ContextMenu>
      </SessionCardTrigger>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={prompt.title}
        description={prompt.description}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false)
                closeTab({ projectPath, sessionId, discardEdits: true })
              }}
            >
              {prompt.confirm}
            </Button>
          </>
        }
      />
    </>
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

  const step = (by: -1 | 1) => {
    if (selectedSessionId === null) return
    const next = moveBy(
      tabs.map((tab) => tab.sessionId),
      selectedSessionId,
      by,
    )
    if (next !== null) reorder({ projectPath, sessionIds: next })
  }
  const startSession = useStartSession()
  const { tabs: tabSettings } = useAtomValue(settingsAtom)
  const newTabAfter =
    tabSettings.newTabPosition === "afterCurrent" ? (selectedSessionId ?? undefined) : undefined
  useCommandHandlers({
    "tab.moveLeft": () => step(-1),
    "tab.moveRight": () => step(1),
    "tab.new": () => void startSession(projectPath, newTabAfter),
  })

  const focusableId = selectedSessionId ?? tabs[0]?.sessionId
  const windowLayout = useWindowLayout()

  return (
    <div className="iv-tab-bar" data-window-layout={windowLayout}>
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
      <NewSessionButton projectPath={projectPath} icon="plus" size="sm" after={newTabAfter} />
    </div>
  )
}
