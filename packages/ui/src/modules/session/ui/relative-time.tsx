import type { RelativeTimeProps } from "@ivin/plugin-api/ui"
import { useNow } from "../../../shared/use-now.ts"
import { relativeTime } from "../rules/relative-time.ts"

export function RelativeTime({ at }: RelativeTimeProps) {
  const now = useNow()
  return (
    <time dateTime={new Date(at.epochMilliseconds).toISOString()}>
      {relativeTime(at.epochMilliseconds, now)}
    </time>
  )
}
