import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SubView } from "@ivin/contracts/tab"
import { Exit } from "effect"
import { useContext, useState, type RefObject } from "react"
import { fileEditOf, unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { writeFileAtom } from "../../file/atoms/write-file.ts"
import { noEdit } from "../../file/rules/file-edit.ts"
import { closeSubViewAtom } from "../atoms/close-sub-view.ts"
import { openSubViewAtom } from "../atoms/open-sub-view.ts"
import { selectSessionTabAtom } from "../atoms/select-session-tab.ts"
import { setFullWidthAtom } from "../atoms/set-full-width.ts"
import {
  closeFileFailure,
  selectSessionTabFailure,
  switchModeFailure,
} from "../rules/sub-view-failure.ts"

interface Failure {
  readonly message: string
  readonly retry: () => void
}

export function useSubViewActions(
  sessionId: string,
  workingFolder: string,
  card: RefObject<HTMLElement | null>,
) {
  const open = useAtomSet(openSubViewAtom)
  const close = useAtomSet(closeSubViewAtom, { mode: "promiseExit" })
  const setFullWidth = useAtomSet(setFullWidthAtom, { mode: "promiseExit" })
  const selectSessionTab = useAtomSet(selectSessionTabAtom, { mode: "promiseExit" })
  const [failure, setFailure] = useState<Failure | null>(null)
  const unsaved = useAtomValue(unsavedPathsOf(sessionId, workingFolder))
  // Kept once the prompt closes, so its text stays while it fades out.
  const [closing, setClosing] = useState<SubView | null>(null)
  const [confirming, setConfirming] = useState(false)
  const write = useAtomSet(writeFileAtom, { mode: "promise" })
  const registry = useContext(RegistryContext)

  const closeNow = async (subView: SubView) => {
    const hadFocus = card.current?.contains(document.activeElement) ?? false
    setFailure(null)
    const exit = await close({ sessionId, workingFolder, subView })
    if (Exit.isFailure(exit))
      return setFailure({
        message: closeFileFailure(subView.path),
        retry: () => void closeNow(subView),
      })
    if (subView.kind === "file")
      registry.set(fileEditOf(sessionId, workingFolder, subView.path), noEdit)
    // The focused close button is gone with its tab.
    if (hadFocus)
      card.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
  }

  const isUnsaved = (subView: SubView) => subView.kind === "file" && unsaved.includes(subView.path)

  const closeFile = async (subView: SubView) => {
    if (!isUnsaved(subView)) return closeNow(subView)
    setClosing(subView)
    setConfirming(true)
  }

  const saveAndClose = async (subView: SubView) => {
    setConfirming(false)
    if (await write({ sessionId, workingFolder, path: subView.path })) await closeNow(subView)
    // Its failure shows in its own view.
    else open({ sessionId, workingFolder, subView })
  }

  const switchMode = async (to: boolean) => {
    setFailure(null)
    const exit = await setFullWidth({ sessionId, workingFolder, fullWidth: to })
    if (Exit.isFailure(exit))
      setFailure({ message: switchModeFailure(to), retry: () => void switchMode(to) })
  }

  const showSession = async () => {
    setFailure(null)
    const exit = await selectSessionTab({ sessionId, workingFolder })
    if (Exit.isFailure(exit))
      setFailure({ message: selectSessionTabFailure, retry: () => void showSession() })
  }

  return {
    failure,
    closing,
    confirming,
    setConfirming,
    isUnsaved,
    closeFile,
    closeNow,
    saveAndClose,
    switchMode,
    showSession,
  }
}
