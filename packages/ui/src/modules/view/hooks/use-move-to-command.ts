import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { openMoveMenu } from "../adapters/view-tabs.ts"

export function useMoveToCommand() {
  useCommandHandler("view.moveTo", openMoveMenu)
}
