import { Toast } from "@base-ui/react/toast"
import type { NotifyOptions } from "@ivin/plugin-api/ui"

export const SHOWN_FOR = 6000
export const MOST_SHOWN = 5

export const notificationManager = Toast.createToastManager()

export function notify({ kind = "error", message, action }: NotifyOptions): void {
  const id: string = notificationManager.add({
    type: kind,
    description: message,
    timeout: SHOWN_FOR,
    priority: kind === "error" ? "high" : "low",
    ...(action && {
      actionProps: {
        children: action.label,
        onClick: () => {
          notificationManager.close(id)
          action.onClick()
        },
      },
    }),
  })
}
