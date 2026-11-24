import { RegistryContext, useAtomMount, useAtomValue } from "@effect/atom-react"
import { formatToolInput } from "@ivin/plugin-api/ui"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { isRunning } from "../../session/rules/is-running.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { approvalWaitsOf } from "../atoms/approval-waits.ts"
import { transcriptOf } from "../atoms/get-items.ts"
import { approvalAnnouncement, turnEndAnnouncement } from "../rules/announcements.ts"

function TurnEndWatcher({
  projectPath,
  sessionId,
  announce,
}: {
  projectPath: string
  sessionId: string
  announce: (text: string) => void
}) {
  const registry = useContext(RegistryContext)
  const items = transcriptOf(sessionId).list.items
  useAtomMount(items)
  const running = isRunning(useAtomValue(sessionsOf(projectPath).item(sessionId))?.status)
  // Starts from the status on screen, so opening a session announces nothing.
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running) {
      const text = turnEndAnnouncement(registry.get(items))
      if (text !== null) announce(text)
    }
    wasRunning.current = running
  }, [running, registry, items, announce])
  return null
}

interface Announcement {
  readonly text: string
  // A new node for each announcement, so the same text is read again.
  readonly count: number
}

const nothing: Announcement = { text: "", count: 0 }

function useAnnouncement() {
  const [announcement, setAnnouncement] = useState(nothing)
  const announce = useCallback(
    (text: string) => setAnnouncement((before) => ({ text, count: before.count + 1 })),
    [],
  )
  return [announcement, announce] as const
}

function LiveRegion({ announcement, testId }: { announcement: Announcement; testId: string }) {
  return (
    <div className="iv-visually-hidden" role="status" aria-live="polite" data-testid={testId}>
      <span key={announcement.count}>{announcement.text}</span>
    </div>
  )
}

function useApprovalAnnouncement(projectPath: string): Announcement {
  const { listed, waits } = useAtomValue(approvalWaitsOf(projectPath))
  // Per project, the waits already there when its sessions first listed, then those announced.
  const known = useRef(new Map<string, Set<string>>())
  const [announcement, announce] = useAnnouncement()
  useEffect(() => {
    const seen = known.current.get(projectPath)
    if (seen === undefined) {
      if (!listed) return
      known.current.set(projectPath, new Set(waits.map((wait) => wait.key)))
      return
    }
    for (const { key, title, item } of waits) {
      if (seen.has(key) || item === undefined) continue
      seen.add(key)
      announce(approvalAnnouncement(title, formatToolInput(item.name, item.input)))
    }
  }, [projectPath, listed, waits, announce])
  return announcement
}

export function Announcements({ projectPath }: { projectPath: string }) {
  const { selectedSessionId } = useAtomValue(tabsOf(projectPath).value)
  const [turnEnd, announceTurnEnd] = useAnnouncement()
  const approval = useApprovalAnnouncement(projectPath)
  return (
    <>
      {selectedSessionId !== null && (
        <TurnEndWatcher
          key={selectedSessionId}
          projectPath={projectPath}
          sessionId={selectedSessionId}
          announce={announceTurnEnd}
        />
      )}
      <LiveRegion announcement={turnEnd} testId="turn-end-announcement" />
      <LiveRegion announcement={approval} testId="approval-announcement" />
    </>
  )
}
