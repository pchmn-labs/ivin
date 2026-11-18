import type {
  Keybinding,
  KeybindingsFileProblem,
  UserKeybindings,
} from "@ivin/contracts/keybinding"
import { parseJsonc } from "../../../shared/rules/parse-jsonc.ts"

type Read =
  | { readonly keybindings: ReadonlyArray<Keybinding> }
  | { readonly problem: KeybindingsFileProblem }

const readEntry = (entry: unknown): Keybinding | null => {
  if (typeof entry !== "object" || entry === null) return null
  const { key, command, when } = entry as Record<string, unknown>
  if (typeof key !== "string" || key.trim() === "") return null
  if (typeof command !== "string" || command.trim() === "") return null
  if (when !== undefined && typeof when !== "string") return null
  return { key, command, when: when ?? null }
}

const read = (text: string | null): Read => {
  if (text === null || text.trim() === "") return { keybindings: [] }
  const parsed = parseJsonc(text)
  if (!parsed.ok) return { problem: { reason: "notJson", entry: null } }
  if (!Array.isArray(parsed.value)) return { problem: { reason: "notAList", entry: null } }
  const keybindings: Array<Keybinding> = []
  for (const [index, entry] of parsed.value.entries()) {
    const keybinding = readEntry(entry)
    if (keybinding === null) return { problem: { reason: "invalidEntry", entry: index + 1 } }
    keybindings.push(keybinding)
  }
  return { keybindings }
}

export const readKeybindingsFile = (
  previous: UserKeybindings,
  text: string | null,
): UserKeybindings => {
  const result = read(text)
  return "problem" in result
    ? { keybindings: previous.keybindings, problem: result.problem }
    : { keybindings: result.keybindings, problem: null }
}
