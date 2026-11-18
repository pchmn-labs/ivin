import type { Session } from "@ivin/contracts/session"
import { Icon } from "../../../core/components/icon/icon.tsx"
import "./session-location.css"

export function SessionLocation({
  session,
  compact = false,
}: {
  session: Pick<Session, "inWorktree" | "branch" | "workingFolder">
  compact?: boolean
}) {
  const kind = session.inWorktree ? "Worktree" : "Checkout"
  return (
    <span
      className="iv-session-location"
      data-compact={compact || undefined}
      data-testid="session-location"
      title={session.workingFolder || undefined}
    >
      <span className="iv-session-location__item">
        <Icon name={session.inWorktree ? "worktree" : "folder"} size={12} />
        <span className={compact ? "iv-visually-hidden" : undefined}>{kind}</span>
      </span>
      {session.branch !== null && (
        <span className="iv-session-location__item iv-session-location__branch">
          {!compact && <Icon name="git-branch" size={12} />}
          <span className="iv-session-location__name">{session.branch}</span>
        </span>
      )}
    </span>
  )
}
