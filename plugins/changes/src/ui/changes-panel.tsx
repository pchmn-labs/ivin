import { useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { FOLDER_DELETED } from "../rules/messages.ts"
import type { OnScreen } from "../rules/on-screen.ts"
import { ChangesOf } from "./changes-of.tsx"
import { Message } from "./message.tsx"

export function ChangesPanel({ onScreen }: { onScreen: OnScreen }) {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  if (sessionId === null)
    return <Message>No session on screen. Open one to see its changes.</Message>
  if (session === undefined) return null
  if (session.workingFolderDeleted) return <Message>{FOLDER_DELETED}</Message>
  return (
    <ChangesOf
      key={`${session.id}\n${session.workingFolder}`}
      session={session}
      onScreen={onScreen}
    />
  )
}
