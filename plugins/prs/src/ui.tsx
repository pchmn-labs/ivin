import { defineUi } from "@ivin/plugin-api/ui"
import { PrBadge } from "./ui/pr-badge.tsx"
import { PrCard } from "./ui/pr-card.tsx"

export const activate = defineUi((ctx) => {
  ctx.slots.add("session.badge", PrBadge, { name: "badge" })
  ctx.slots.add("session.card", PrCard, { name: "card" })
})
