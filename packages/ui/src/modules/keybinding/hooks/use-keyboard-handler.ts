import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import { runCommand } from "../../command/atoms/run-command.ts"
import { keybindingsOf } from "../atoms/keybindings.ts"
import { focusAreas } from "../adapters/focus-areas.ts"
import { isMac } from "../adapters/platform.ts"
import { eventKey } from "../rules/key.ts"
import { findCommand } from "../rules/resolve-keybindings.ts"

// Runs on the window, after the controls: a key one of them used is marked `defaultPrevented`.
export function useKeyboardHandler() {
  const registry = useContext(RegistryContext)
  const keybindings = useAtomValue(keybindingsOf(isMac()))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const command = findCommand(keybindings, eventKey(event), focusAreas())
      if (command !== null && runCommand(registry, command)) event.preventDefault()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [registry, keybindings])
}
