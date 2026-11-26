import type { SessionLocationPickerProps } from "@ivin/plugin-api/ui"
import { useIsWorkspace } from "../../project/hooks/use-is-workspace.ts"
import { contractSession } from "../rules/plugin-session.ts"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { BranchPicker } from "./branch-picker.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"

export function SessionLocationPicker(props: SessionLocationPickerProps) {
  const session = contractSession(props.session)
  const location = useSessionLocation(session)
  const workspace = useIsWorkspace(session.projectPath)
  const choosing = !session.started && session.status !== "preparing_worktree"
  // Outside a git repository there is nothing to choose, nor on a workspace yet.
  return choosing && location.kind !== "folder" && !workspace ? (
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
