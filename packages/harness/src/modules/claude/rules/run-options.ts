import type { HarnessRunOptions, OfferedModel, OfferedValue } from "@ivin/contracts/session"

const EFFORTS: OfferedValue[] = [
  { value: "low", name: "Low", description: null },
  { value: "medium", name: "Medium", description: null },
  { value: "high", name: "High", description: null },
  { value: "xhigh", name: "Extra high", description: null },
  { value: "max", name: "Max", description: null },
]

const PERMISSION_MODES: OfferedValue[] = [
  { value: "manual", name: "Manual", description: "Asks before edits and commands" },
  { value: "acceptEdits", name: "Accept edits", description: "Edits files without asking" },
  { value: "auto", name: "Auto", description: "A classifier decides what to ask" },
  { value: "dontAsk", name: "Don't ask", description: "Denies what is not allowed" },
  { value: "plan", name: "Plan", description: "Reads and plans, changes nothing" },
  { value: "bypassPermissions", name: "Bypass permissions", description: "Never asks" },
]

const alias = (value: string, name: string): OfferedModel => ({
  value,
  name,
  description: null,
  efforts: EFFORTS.map((effort) => effort.value),
  older: false,
})

// When Claude Code cannot list its models.
export const FALLBACK_MODELS: OfferedModel[] = [
  alias("opus", "Opus"),
  alias("fable", "Fable"),
  alias("sonnet", "Sonnet"),
  alias("haiku", "Haiku"),
]

const DEFAULT_MODEL = "sonnet"

export const claudeRunOptions = (listed: readonly OfferedModel[]): HarnessRunOptions => {
  const models = listed.length > 0 ? listed : FALLBACK_MODELS
  return {
    model: {
      values: models,
      default: models.some((model) => model.value === DEFAULT_MODEL)
        ? DEFAULT_MODEL
        : models[0]!.value,
    },
    effort: { values: EFFORTS, default: "high" },
    permissionMode: { values: PERMISSION_MODES, default: "manual" },
  }
}
