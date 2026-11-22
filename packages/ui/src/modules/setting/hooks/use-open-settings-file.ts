import { useAtomSet } from "@effect/atom-react"
import { useState } from "react"
import { writeErrorAtom } from "../../log/atoms/write-error.ts"
import { errorReport } from "../../log/rules/error-report.ts"
import { openSettingsFile } from "../adapters/open-settings-file.ts"
import { SETTINGS_FILE } from "../rules/setting-message.ts"

export function useOpenSettingsFile() {
  const [failure, setFailure] = useState<string | null>(null)
  const writeError = useAtomSet(writeErrorAtom)
  const open = async () => {
    setFailure(null)
    const reason = await openSettingsFile()
    if (reason === null) return
    writeError(errorReport("settings.openFile", reason))
    setFailure(`${SETTINGS_FILE} did not open.`)
  }
  return { open, failure }
}
