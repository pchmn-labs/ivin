import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import { runCommand } from "../../command/atoms/run-command.ts"
import { keybindingsOf } from "../atoms/keybindings.ts"
import { focusAreas, focusIsOnButton } from "../adapters/focus-areas.ts"
import { isMac } from "../adapters/platform.ts"
import { eventKeys } from "../rules/key.ts"
import { findCommands } from "../rules/resolve-keybindings.ts"

// Runs on the window, after the controls: a key one of them used is marked `defaultPrevented`.
export function useKeyboardHandler() {
  const registry = useContext(RegistryContext)
  const keybindings = useAtomValue(keybindingsOf(isMac()))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      // Enter and Space press the focused button.
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      if ((event.key === "Enter" || event.key === " ") && plain && focusIsOnButton()) return
      const commands = findCommands(keybindings, eventKeys(event), focusAreas())
      // A command no component handles right now leaves the key to the next keybinding.
      if (commands.some((command) => runCommand(registry, command))) event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [registry, keybindings])
}
