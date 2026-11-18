import type { BlockProps } from "@ivin/plugin-api/ui"
import "./block.css"

export type { BlockProps }

export function Block({ tone = "subtle", padding = 3, children, ...rest }: BlockProps) {
  return (
    <div {...rest} className={`iv-block iv-block--${tone} iv-block--pad-${padding}`}>
      {children}
    </div>
  )
}
