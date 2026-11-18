import type { Keybinding } from "@ivin/contracts/keybinding"
import { normalizeKey, type Platform } from "./key.ts"

export interface ResolvedKeybinding {
  // Normalised, see `normalizeKey`.
  readonly key: string
  readonly written: string
  readonly command: string
  readonly when: string | null
}

export interface KeybindingConflict {
  readonly key: string
  readonly when: string | null
  readonly defaultCommand: string
  readonly userCommand: string
}

const REMOVAL = "-"

export const resolveKeybindings = (input: {
  readonly defaults: ReadonlyArray<Keybinding>
  readonly user: ReadonlyArray<Keybinding>
  readonly platform: Platform
}): {
  readonly keybindings: ReadonlyArray<ResolvedKeybinding>
  readonly conflicts: ReadonlyArray<KeybindingConflict>
  readonly unreadable: ReadonlyArray<string>
} => {
  const unreadable: Array<string> = []
  const read = (keybinding: Keybinding): ResolvedKeybinding | null => {
    const key = normalizeKey(keybinding.key, input.platform)
    if (key === null) unreadable.push(keybinding.key)
    return key === null ? null : { ...keybinding, key, written: keybinding.key }
  }
  const user = input.user.map(read).filter((k) => k !== null)
  const removals = user.filter((k) => k.command.startsWith(REMOVAL))
  const added = user.filter((k) => !k.command.startsWith(REMOVAL))
  const defaults = input.defaults
    .map(read)
    .filter((k) => k !== null)
    .filter(
      (d) =>
        !removals.some(
          (r) =>
            r.key === d.key &&
            r.command.slice(REMOVAL.length) === d.command &&
            (r.when === null || r.when === d.when),
        ),
    )

  const conflicts = added.flatMap((u) =>
    defaults
      .filter((d) => d.key === u.key && d.when === u.when && d.command !== u.command)
      .map((d) => ({
        key: u.written,
        when: u.when,
        defaultCommand: d.command,
        userCommand: u.command,
      })),
  )
  return { keybindings: [...defaults, ...added], conflicts, unreadable }
}

// `areas` holds the areas around the focus, closest first. The last of equal keybindings wins.
export const findCommand = (
  keybindings: ReadonlyArray<ResolvedKeybinding>,
  key: string,
  areas: ReadonlyArray<string>,
): string | null => {
  for (const area of [...areas, null]) {
    const found = keybindings.findLast((k) => k.key === key && k.when === area)
    if (found !== undefined) return found.command
  }
  return null
}

export const keyOfCommand = (
  keybindings: ReadonlyArray<ResolvedKeybinding>,
  command: string,
): string | null => keybindings.findLast((k) => k.command === command)?.written ?? null
