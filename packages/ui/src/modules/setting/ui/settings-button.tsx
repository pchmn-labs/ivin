import { RegistryContext } from "@effect/atom-react"
import { useContext } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { runCommand } from "../../command/atoms/run-command.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"

export function SettingsButton() {
  const registry = useContext(RegistryContext)
  const hint = useKeyHint("Settings", "settings.open")
  return (
    <IconButton
      icon="gear"
      label="Settings"
      tooltip={hint}
      size="sm"
      onClick={() => runCommand(registry, "settings.open")}
    />
  )
}
