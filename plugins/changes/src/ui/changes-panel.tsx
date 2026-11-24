import { EmptyMessage, useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { FOLDER_DELETED } from "../rules/messages.ts"
import type { OnScreen } from "../rules/on-screen.ts"
import { ChangesOf } from "./changes-of.tsx"

export function ChangesPanel({ onScreen }: { onScreen: OnScreen }) {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  if (sessionId === null)
    return <EmptyMessage>No session on screen. Open one to see its changes.</EmptyMessage>
  if (session === undefined) return null
  if (session.workingFolderDeleted) return <EmptyMessage>{FOLDER_DELETED}</EmptyMessage>
  return (
    <ChangesOf
      key={`${session.id}\n${session.workingFolder}`}
      session={session}
      onScreen={onScreen}
    />
  )
}
