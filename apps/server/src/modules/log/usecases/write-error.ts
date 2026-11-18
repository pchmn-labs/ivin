import type { ErrorReport } from "@ivin/contracts/log"
import { Effect } from "effect"

export const writeError = ({ action, type, message, stack }: ErrorReport) =>
  Effect.logError({ name: type, message, stack }).pipe(
    Effect.annotateLogs({ source: "ui", action }),
  )
