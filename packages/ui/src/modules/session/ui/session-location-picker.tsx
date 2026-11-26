import type { SessionLocationPickerProps } from "@ivin/plugin-api/ui"
import { useWorkspaceFolders } from "../../project/hooks/use-is-workspace.ts"
import { contractSession } from "../rules/plugin-session.ts"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { BranchPicker } from "./branch-picker.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"
import { WorkspaceBranch, WorkspaceFolderPicker } from "./workspace-folder-picker.tsx"

export function SessionLocationPicker(props: SessionLocationPickerProps) {
  const session = contractSession(props.session)
  const location = useSessionLocation(session)
  const folders = useWorkspaceFolders(session.projectPath)
  const choosing = !session.started && session.status !== "preparing_worktree"
  if (folders !== null) {
    return choosing ? (
      <WorkspaceFolderPicker session={session} location={location} folders={folders} />
    ) : (
      <SessionLocation
        location={location}
        title={session.workingFolder}
        {...(location.branch !== null && {
          branch: <WorkspaceBranch session={session} location={location} folders={folders} />,
        })}
      />
    )
  }
  // Outside a git repository there is nothing to choose.
  return choosing && location.kind !== "folder" ? (
    <WorkingFolderPicker session={session} location={location} />
  ) : (
    <SessionLocation
      location={location}
      title={session.workingFolder}
      {...(location.branch !== null &&
        location.deleted !== true && {
          branch: <BranchPicker session={session} branch={location.branch} />,
        })}
    />
  )
}
