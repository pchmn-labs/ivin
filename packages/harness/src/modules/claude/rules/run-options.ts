import type { HarnessRunOptions } from "@ivin/contracts/session"

export const claudeRunOptions: HarnessRunOptions = {
  model: { values: ["opus", "sonnet", "haiku"], default: "sonnet" },
  effort: { values: ["low", "medium", "high", "xhigh", "max"], default: "high" },
  permissionMode: {
    values: ["manual", "acceptEdits", "auto", "dontAsk", "plan", "bypassPermissions"],
    default: "manual",
  },
}
