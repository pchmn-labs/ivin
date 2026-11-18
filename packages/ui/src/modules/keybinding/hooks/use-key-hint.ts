import { useAtomValue } from "@effect/atom-react"
import { keybindingsOf } from "../atoms/keybindings.ts"
import { isMac } from "../adapters/platform.ts"
import { formatKey } from "../rules/key.ts"
import { keyOfCommand } from "../rules/resolve-keybindings.ts"

// `title` followed by the key of the command, as a tooltip shows it: "Toggle sidebar (⌘\)".
export function useKeyHint(title: string, commandId: string): string {
  const mac = isMac()
  const key = keyOfCommand(useAtomValue(keybindingsOf(mac)), commandId)
  return key === null ? title : `${title} (${formatKey(key, { mac })})`
}
