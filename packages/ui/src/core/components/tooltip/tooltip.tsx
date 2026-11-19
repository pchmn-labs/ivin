import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import type { TooltipProps } from "@ivin/plugin-api/ui"
import "./tooltip.css"

export type { TooltipProps }

export function Tooltip({ content, label, mono = false, children, side = "top" }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={400} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} collisionPadding={8}>
          <BaseTooltip.Popup className="iv-tooltip" data-mono={mono || undefined}>
            {label === undefined ? null : <span className="iv-tooltip__label">{label}</span>}
            <span className="iv-tooltip__content">{content}</span>
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
