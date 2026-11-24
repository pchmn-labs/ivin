import { RegistryContext, useAtomMount, useAtomValue } from "@effect/atom-react"
import { formatToolInput } from "@ivin/plugin-api/ui"
import { useContext, useEffect, useRef, useState } from "react"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { isRunning } from "../../session/rules/is-running.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { approvalRequestsOf } from "../atoms/approval-requests.ts"
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

function useApprovalAnnouncement(projectPath: string): string {
  const requests = useAtomValue(approvalRequestsOf(projectPath))
  const announced = useRef(new Set<string>())
  const [text, setText] = useState("")
  useEffect(() => {
    const next = requests.findLast((request) => !announced.current.has(request.item.requestId))
    for (const request of requests) announced.current.add(request.item.requestId)
    if (next !== undefined) {
      setText(approvalAnnouncement(next.title, formatToolInput(next.item.name, next.item.input)))
    }
  }, [requests])
  return text
}

export function Announcements({ projectPath }: { projectPath: string }) {
  const { selectedSessionId } = useAtomValue(tabsOf(projectPath).value)
  const [turnEnd, setTurnEnd] = useState("")
  const approval = useApprovalAnnouncement(projectPath)
  return (
    <>
      {selectedSessionId !== null && (
        <TurnEndWatcher
          key={selectedSessionId}
          projectPath={projectPath}
          sessionId={selectedSessionId}
          announce={setTurnEnd}
        />
      )}
      <div
        className="iv-visually-hidden"
        role="status"
        aria-live="polite"
        data-testid="turn-end-announcement"
      >
        {turnEnd}
      </div>
      <div
        className="iv-visually-hidden"
        role="status"
        aria-live="polite"
        data-testid="approval-announcement"
      >
        {approval}
      </div>
    </>
  )
}
