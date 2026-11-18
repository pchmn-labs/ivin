import type { RelativeTimeProps } from "@ivin/plugin-api/ui"
import { DateTime } from "effect"
import { useNow } from "../../../shared/use-now.ts"
import { relativeTime } from "../rules/relative-time.ts"

export function RelativeTime({ at }: RelativeTimeProps) {
  const now = useNow()
  return (
    <time dateTime={DateTime.formatIso(at)}>{relativeTime(DateTime.toEpochMillis(at), now)}</time>
  )
}
