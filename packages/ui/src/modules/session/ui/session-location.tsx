import type { ReactNode } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import type { WorkingFolderLabel } from "../rules/session-location.ts"
import "./session-location.css"

const ICONS = { checkout: "folder", worktree: "worktree", folder: "folder" } as const

export function SessionLocation({
  location,
  compact = false,
  title,
  branch,
}: {
  location: WorkingFolderLabel
  // Replaces the branch label, such as with a control to change it.
  branch?: ReactNode
  // The sidebar row shows the branch alone, or the label when there is no branch.
  compact?: boolean
  title?: string
}) {
  const labelHidden = compact && location.branch !== null
  return (
    <span
      className="iv-session-location"
      data-compact={compact || undefined}
      data-testid="session-location"
      title={title}
    >
      <span className="iv-session-location__item">
        <Icon name={ICONS[location.kind]} size={12} />
        <span className={labelHidden ? "iv-visually-hidden" : "iv-session-location__name"}>
          {location.label}
        </span>
      </span>
      {location.branch !== null && branch}
      {location.branch !== null && branch === undefined && (
        <span className="iv-session-location__item iv-session-location__branch">
          {!compact && <Icon name="git-branch" size={12} />}
          <span className="iv-session-location__name">{location.branch}</span>
        </span>
      )}
    </span>
  )
}
