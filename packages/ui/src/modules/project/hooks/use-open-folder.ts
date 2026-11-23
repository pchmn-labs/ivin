import { useAtomSet } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import { pickFolder } from "../adapters/pick-folder.ts"
import { folderToTrustAtom } from "../atoms/folder-to-trust.ts"
import { openFolderFailureAtom } from "../atoms/open-folder-failure.ts"
import { openProjectAtom } from "../atoms/open-project.ts"
import { isNotTrusted, openProjectFailure } from "../rules/failure-message.ts"

export function useOpenFolder() {
  const openProject = useAtomSet(openProjectAtom, { mode: "promiseExit" })
  const setFailure = useAtomSet(openFolderFailureAtom)
  const setFolderToTrust = useAtomSet(folderToTrustAtom)
  const open = async (path: string, trust = false) => {
    setFailure(null)
    const exit = await openProject(trust ? { path, trust } : { path })
    if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
    const error = Cause.squash(exit.cause)
    if (isNotTrusted(error)) setFolderToTrust(path)
    else setFailure({ path, failure: openProjectFailure(error) })
  }
  const openFolder = async () => {
    const path = await pickFolder()
    if (path !== null) await open(path)
  }
  return {
    openFolder: () => void openFolder(),
    retry: (path: string) => void open(path),
    trust: (path: string) => void open(path, true),
  }
}
