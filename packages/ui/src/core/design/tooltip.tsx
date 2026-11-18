import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import type { TooltipProps } from "@ivin/plugin-api/ui"
import "./tooltip.css"

export type { TooltipProps }

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={400} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6}>
          <BaseTooltip.Popup className="iv-tooltip">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
