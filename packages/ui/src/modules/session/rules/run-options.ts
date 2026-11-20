import type { HarnessRunOptions, RunOption, RunOptions } from "@ivin/contracts/session"

export const RUN_OPTIONS: ReadonlyArray<RunOption> = ["model", "effort", "permissionMode"]

export const RUN_OPTION_LABELS: Record<RunOption, string> = {
  model: "Model",
  effort: "Effort",
  permissionMode: "Permission mode",
}

// The current value stays listed when the harness no longer offers it, so the menu shows what is set.
export const offeredValues = (
  offered: HarnessRunOptions | null,
  option: RunOption,
  current: string,
): ReadonlyArray<string> => {
  const values = offered?.[option].values ?? []
  return values.includes(current) ? values : [current, ...values]
}

export const changedRunOptions = (
  current: RunOptions,
  previous: RunOptions,
): ReadonlyArray<{ readonly option: RunOption; readonly from: string; readonly to: string }> =>
  RUN_OPTIONS.filter((option) => current[option] !== previous[option]).map((option) => ({
    option,
    from: previous[option],
    to: current[option],
  }))

export const relaunchFailureText = (current: RunOptions, previous: RunOptions) => {
  const changes = changedRunOptions(current, previous)
  const what = changes
    .map(({ option, to }) => `${RUN_OPTION_LABELS[option].toLowerCase()} ${to}`)
    .join(", ")
  return what === ""
    ? "The agent failed on the first message after the change."
    : `The agent failed on the first message with ${what}. Go back to what worked, or pick another value.`
}

export const goBackLabel = (current: RunOptions, previous: RunOptions) => {
  const changes = changedRunOptions(current, previous)
  return changes.length === 1 ? `Back to ${changes[0]!.from}` : "Go back"
}
