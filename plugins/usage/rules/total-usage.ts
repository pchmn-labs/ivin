import type { TranscriptItem } from "@ivin/plugin-api/ui"

export interface UsageTotal {
  readonly tokens: number
  readonly costUsd: number
}

export const totalUsage = (items: ReadonlyArray<TranscriptItem>): UsageTotal | null => {
  const usages = items.filter((item) => item.type === "usage")
  if (usages.length === 0) return null
  return {
    tokens: usages.reduce((sum, u) => sum + u.inputTokens + u.outputTokens, 0),
    costUsd: usages.reduce((sum, u) => sum + (u.costUsd ?? 0), 0),
  }
}

export const formatUsage = (total: UsageTotal): string =>
  `${total.tokens.toLocaleString("en-US")} tokens · $${total.costUsd.toFixed(4)}`
