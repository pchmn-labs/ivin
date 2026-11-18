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
} => {
  const read = (keybinding: Keybinding): ResolvedKeybinding | null => {
    const key = normalizeKey(keybinding.key, input.platform)
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
  return { keybindings: [...defaults, ...added], conflicts }
}

// The commands bound to any of `keys`, in the order to try them; `areas` is closest first.
export const findCommands = (
  keybindings: ReadonlyArray<ResolvedKeybinding>,
  keys: ReadonlyArray<string>,
  areas: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  [...areas, null].flatMap((area) =>
    keybindings
      .filter((k) => keys.includes(k.key) && k.when === area)
      .map((k) => k.command)
      .reverse(),
  )

export const findCommand = (
  keybindings: ReadonlyArray<ResolvedKeybinding>,
  key: string,
  areas: ReadonlyArray<string>,
): string | null => findCommands(keybindings, [key], areas)[0] ?? null

// What `mod` stands for does not change whether a key can be read.
export const unreadableKeys = (keybindings: ReadonlyArray<Keybinding>): ReadonlyArray<string> =>
  keybindings.filter((k) => normalizeKey(k.key, { mac: false }) === null).map((k) => k.key)

export const keyOfCommand = (
  keybindings: ReadonlyArray<ResolvedKeybinding>,
  command: string,
): string | null => keybindings.findLast((k) => k.command === command)?.written ?? null
