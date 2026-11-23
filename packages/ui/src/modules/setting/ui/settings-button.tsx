import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { useContext } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { runCommand } from "../../command/atoms/run-command.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { connectionAtom } from "../../server/atoms/connection.ts"
import "./settings-button.css"

export function SettingsButton() {
  const registry = useContext(RegistryContext)
  const hint = useKeyHint("Settings", "settings.open")
  const lost = useAtomValue(connectionAtom).state === "failed"
  return (
    <span className="iv-settings-button">
      <IconButton
        icon="gear"
        label="Settings"
        tooltip={hint}
        size="sm"
        onClick={() => runCommand(registry, "settings.open")}
      />
      {lost && (
        <span className="iv-settings-button__lost" aria-hidden="true" data-testid="server-lost" />
      )}
    </span>
  )
}
