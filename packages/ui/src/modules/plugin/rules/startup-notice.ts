import { StartupNotice } from "@ivin/contracts/plugin"
import * as Schema from "effect/Schema"

export const startupNoticeOf = (raw: unknown): StartupNotice | null =>
  Schema.is(StartupNotice)(raw) ? raw : null

export const startupNoticeMessage = (notice: StartupNotice): string => {
  switch (notice._tag) {
    case "safeForced":
      return "Safe mode: ivin started with only its built-in plugins because of --safe."
    case "safeAfterCrash":
      return "Safe mode: ivin did not finish starting last time, so it started with only its built-in plugins. User and project plugins are off; relaunch to turn them back on."
    case "reloadedWithout":
      return `The window stopped answering and was reloaded without ${notice.plugins.join(", ")}. Turn a plugin back on with \`ivin plugin enable <id>\`.`
  }
}
