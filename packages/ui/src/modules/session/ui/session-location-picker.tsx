import type { SessionLocationPickerProps } from "@ivin/plugin-api/ui"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { BranchPicker } from "./branch-picker.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"

export function SessionLocationPicker({ session }: SessionLocationPickerProps) {
  const location = useSessionLocation(session)
  const choosing = !session.started && session.status !== "preparing_worktree"
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
