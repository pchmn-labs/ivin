import type { HarnessRunOptions, RunOption, RunOptions } from "@ivin/plugin-api/ui"

const RUN_OPTIONS: ReadonlyArray<RunOption> = ["model", "effort", "permissionMode"]

const nameOf = (offered: HarnessRunOptions | null, option: RunOption, value: string) =>
  offered?.[option].values.find((offer) => offer.value === value)?.name ?? value

const changedRunOptions = (current: RunOptions, previous: RunOptions) =>
  RUN_OPTIONS.filter((option) => current[option] !== previous[option])

export const changedRunOption = (current: RunOptions, previous: RunOptions): RunOption =>
  changedRunOptions(current, previous)[0] ?? "model"

export const relaunchFailureText = (
  offered: HarnessRunOptions | null,
  current: RunOptions,
  previous: RunOptions,
) => {
  const names = changedRunOptions(current, previous).map((option) =>
    nameOf(offered, option, current[option]),
  )
  return names.length === 0
    ? "The agent did not start after the change."
    : `The agent did not start with ${names.join(", ")}.`
}

export const goBackLabel = (
  offered: HarnessRunOptions | null,
  current: RunOptions,
  previous: RunOptions,
) => {
  const [only, ...others] = changedRunOptions(current, previous)
  return only !== undefined && others.length === 0
    ? `Back to ${nameOf(offered, only, previous[only])}`
    : "Go back"
}
