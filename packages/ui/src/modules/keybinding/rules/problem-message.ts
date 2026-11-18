import type { KeybindingsFileProblem } from "@ivin/contracts/keybinding"

export const problemMessage = ({ reason, entry }: KeybindingsFileProblem): string => {
  const what =
    reason === "notJson"
      ? "~/.ivin/keybindings.json is not valid JSON"
      : reason === "notAList"
        ? "~/.ivin/keybindings.json must hold a list of keybindings"
        : `Keybinding ${entry} in ~/.ivin/keybindings.json needs a "key" and a "command"`
  return `${what}. The previous keybindings stay in use until it is fixed.`
}

export const unreadableKeysMessage = (keys: ReadonlyArray<string>): string =>
  `~/.ivin/keybindings.json has keys ivin cannot read, which do nothing: ${keys.map((k) => `"${k}"`).join(", ")}.`
