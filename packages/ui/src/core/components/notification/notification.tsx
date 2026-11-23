import { Toast } from "@base-ui/react/toast"
import type { NotificationKind, NotifyOptions } from "@ivin/plugin-api/ui"
import { createContext, type ReactNode, useContext } from "react"
import { Icon, type IconName } from "../icon/icon.tsx"
import { MOST_SHOWN, notificationManager, SHOWN_FOR } from "./notification-manager.ts"
import "../button/button.css"
import "./notification.css"

export type { NotificationKind, NotifyOptions }

const icons: Record<NotificationKind, IconName> = {
  error: "circle-alert",
  warning: "triangle-alert",
  info: "circle-info",
  success: "circle-check",
}

function Notifications() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="iv-notification">
      <Toast.Content className="iv-notification__content">
        <span className="iv-notification__icon">
          <Icon name={icons[toast.type as NotificationKind] ?? "circle-alert"} size={16} />
        </span>
        <Toast.Description className="iv-notification__message" />
        {toast.actionProps && <Toast.Action className="iv-button iv-button--ghost iv-button--sm" />}
        <Toast.Close
          aria-label="Close"
          className="iv-button iv-button--icon iv-button--ghost iv-button--sm"
        >
          <Icon name="x" size={14} />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ))
}

const ProviderMounted = createContext(false)

// Above the views that draw the viewport, so the notifications outlive a view that remounts.
export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={notificationManager} timeout={SHOWN_FOR} limit={MOST_SHOWN}>
      <ProviderMounted value>{children}</ProviderMounted>
    </Toast.Provider>
  )
}

// Draws nothing outside a provider, so a view mounted alone, as a test does, needs none.
export function NotificationViewport() {
  if (!useContext(ProviderMounted)) return null
  return (
    <Toast.Viewport className="iv-notifications">
      <Notifications />
    </Toast.Viewport>
  )
}
