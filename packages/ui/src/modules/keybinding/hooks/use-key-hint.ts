import { useAtomValue } from "@effect/atom-react"
import { keybindingsOf } from "../atoms/keybindings.ts"
import { isMac } from "../adapters/platform.ts"
import { ariaKey, formatKey } from "../rules/key.ts"
import { keyOfCommand } from "../rules/resolve-keybindings.ts"

// The key of the command as the platform writes it, such as "⇧⌘A"; null when it has none.
export function useCommandKey(commandId: string): string | null {
  return useCommandKeys()(commandId)?.label ?? null
}

// `title` followed by the key of the command, as a tooltip shows it: "Toggle sidebar (⌘\)".
export function useKeyHint(title: string, commandId: string): string {
  const key = useCommandKey(commandId)
  return key === null ? title : `${title} (${key})`
}

export interface CommandKey {
  readonly label: string
  readonly aria: string
}

// Looks up any number of commands' keys, such as one per row, from one subscription.
export function useCommandKeys(): (commandId: string | undefined) => CommandKey | null {
  const mac = isMac()
  const keybindings = useAtomValue(keybindingsOf(mac))
  return (commandId) => {
    const key = commandId === undefined ? null : keyOfCommand(keybindings, commandId)
    return key === null ? null : { label: formatKey(key, { mac }), aria: ariaKey(key, { mac }) }
  }
}
