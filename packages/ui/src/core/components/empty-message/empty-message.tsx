import type { EmptyMessageProps } from "@ivin/plugin-api/ui"
import "./empty-message.css"

export type { EmptyMessageProps }

export function EmptyMessage({ children, ...rest }: EmptyMessageProps) {
  return (
    <p {...rest} className="iv-empty-message">
      {children}
    </p>
  )
}
