import { Text, defineUi, useUsage } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { formatUsage } from "./rules/total-usage.ts"

function UsageStatus({ sessionId }: SlotProps["composer.status"]) {
  const total = useUsage(sessionId)
  if (total === null) return null
  return (
    <Text size="sm" tone="muted" data-testid="usage-status">
      {formatUsage(total)}
    </Text>
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("composer.status", UsageStatus, { name: "status" })
})
