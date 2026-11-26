import { Toast } from "@base-ui/react/toast"
import type { NotifyOptions } from "@ivin/plugin-api/ui"

export const SHOWN_FOR = 6000
export const MOST_SHOWN = 5

const toasts = Toast.createToastManager()
type ToastOptions = Parameters<typeof toasts.add>[0]
let subscribers = 0
// A child's mount effect runs before the provider's subscribing one; its notification would be lost.
const early: ToastOptions[] = []

export const notificationManager: typeof toasts = {
  ...toasts,
  add(options) {
    const toast = { ...options, id: options.id ?? crypto.randomUUID() }
    if (subscribers === 0) early.push(toast)
    else toasts.add(toast)
    return toast.id
  },
  " subscribe"(listener) {
    const stop = toasts[" subscribe"](listener)
    subscribers++
    for (const toast of early.splice(0)) toasts.add(toast)
    return () => {
      subscribers--
      stop()
    }
  },
}

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
