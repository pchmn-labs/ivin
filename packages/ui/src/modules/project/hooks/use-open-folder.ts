import { useAtomSet } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import { pickFolder } from "../adapters/pick-folder.ts"
import { openFolderFailureAtom } from "../atoms/open-folder-failure.ts"
import { openProjectAtom } from "../atoms/open-project.ts"
import { openProjectFailure } from "../rules/failure-message.ts"

export function useOpenFolder() {
  const openProject = useAtomSet(openProjectAtom, { mode: "promiseExit" })
  const setFailure = useAtomSet(openFolderFailureAtom)
  const open = async (path: string) => {
    setFailure(null)
    const exit = await openProject(path)
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
      setFailure({ path, failure: openProjectFailure(Cause.squash(exit.cause)) })
    }
  }
  const openFolder = async () => {
    const path = await pickFolder()
    if (path !== null) await open(path)
  }
  return {
    openFolder: () => void openFolder(),
    retry: (path: string) => void open(path),
  }
}
