import type { SessionUsage } from "@ivin/plugin-api/ui"

export const formatUsage = (total: NonNullable<SessionUsage>): string =>
  `${total.tokens.toLocaleString("en-US")} tokens · $${total.costUsd.toFixed(4)}`
