import { Stack, StatusTile, Text, type Session } from "@ivin/plugin-api/ui"
import { usePrs } from "../hooks/use-prs.ts"
import { tileOf } from "../rules/prs.ts"

export function PrBadge({ session }: { session: Session }) {
  const prs = usePrs(session.id)
  if (prs.length === 0) return null
  const { mark, ...tile } = tileOf(prs)
  return (
    <Stack direction="row" gap={1} align="center">
      <StatusTile {...tile} {...(mark !== undefined && { mark })} />
      {prs.length > 1 && (
        <Text size="xs" weight="medium" tone="faint">
          +{prs.length - 1}
        </Text>
      )}
    </Stack>
  )
}
