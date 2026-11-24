import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { notify } from "../../../core/components/notification/notification-manager.ts"
import { checkForUpdates } from "../adapters/desktop-update.ts"

export function useUpdateCommands() {
  useCommandHandler("update.check", async () => {
    const state = await checkForUpdates()
    if (state.kind === "idle") {
      notify({ kind: "info", message: `ivin is up to date (${state.current}).` })
    }
  })
}
