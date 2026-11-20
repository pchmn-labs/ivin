import { useAtomValue } from "@effect/atom-react"
import { keybindingsOf } from "../atoms/keybindings.ts"
import { isMac } from "../adapters/platform.ts"
import { formatKey } from "../rules/key.ts"
import { keyOfCommand } from "../rules/resolve-keybindings.ts"

// The key of the command as the platform writes it, such as "⇧⌘A"; null when it has none.
export function useCommandKey(commandId: string): string | null {
  const mac = isMac()
  const key = keyOfCommand(useAtomValue(keybindingsOf(mac)), commandId)
  return key === null ? null : formatKey(key, { mac })
}

// `title` followed by the key of the command, as a tooltip shows it: "Toggle sidebar (⌘\)".
export function useKeyHint(title: string, commandId: string): string {
  const key = useCommandKey(commandId)
  return key === null ? title : `${title} (${key})`
}
