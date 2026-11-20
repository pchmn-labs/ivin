import type { ErrorMessageProps } from "@ivin/plugin-api/ui"
import { Button } from "../button/button.tsx"
import { Icon } from "../icon/icon.tsx"
import "./error-message.css"

export type { ErrorMessageProps }

export function ErrorMessage({ message, onRetry, action, ...rest }: ErrorMessageProps) {
  return (
    <div {...rest} role="alert" className="iv-error-message">
      <span className="iv-error-message__icon">
        <Icon name="circle-alert" size={14} />
      </span>
      <span className="iv-error-message__text">{message}</span>
      {action && (
        <Button size="sm" variant="ghost" onClick={action.onSelect}>
          {action.label}
        </Button>
      )}
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
