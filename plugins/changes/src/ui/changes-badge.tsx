import { useSelectedSessionId, useSession } from "@ivin/plugin-api/ui"
import { ChangeCount } from "./change-count.tsx"

export function ChangesBadge() {
  const session = useSession(useSelectedSessionId() ?? "")
  return session === undefined || session.workingFolderDeleted ? null : (
    <ChangeCount session={session} />
  )
}
