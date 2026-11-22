import { useState } from "react"
import { openSettingsFile } from "../adapters/open-settings-file.ts"
import { SETTINGS_FILE } from "../rules/setting-message.ts"

export function useOpenSettingsFile() {
  const [failure, setFailure] = useState<string | null>(null)
  const open = async () => {
    setFailure(null)
    if (!(await openSettingsFile())) setFailure(`${SETTINGS_FILE} did not open.`)
  }
  return { open, failure }
}
