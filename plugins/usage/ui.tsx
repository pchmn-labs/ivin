import { Text, defineUi, useTranscript } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { formatUsage, totalUsage } from "./rules/total-usage.ts"

function UsageStatus({ sessionId }: SlotProps["composer.status"]) {
  const total = totalUsage(useTranscript(sessionId))
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
