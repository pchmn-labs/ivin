import type {
  HarnessRunOptions,
  OfferedValue,
  RunOption,
  RunOptions,
} from "@ivin/contracts/session"

export const RUN_OPTIONS: ReadonlyArray<RunOption> = ["model", "effort", "permissionMode"]

export const RUN_OPTION_LABELS: Record<RunOption, string> = {
  model: "Model",
  effort: "Effort",
  permissionMode: "Permissions",
}

const unnamed = (value: string): OfferedValue => ({ value, name: value, description: null })

// The current value stays listed when the harness no longer offers it, so the menu shows what is set.
export const offeredValues = (
  offered: HarnessRunOptions | null,
  option: RunOption,
  current: string,
): ReadonlyArray<OfferedValue> => {
  const values: ReadonlyArray<OfferedValue> = offered?.[option].values ?? []
  return values.some((offer) => offer.value === current) ? values : [unnamed(current), ...values]
}

export const nameOf = (offered: HarnessRunOptions | null, option: RunOption, value: string) =>
  offered?.[option].values.find((offer) => offer.value === value)?.name ?? value

export const usableEfforts = (offered: HarnessRunOptions | null, model: string) =>
  offered?.model.values.find((offer) => offer.value === model)?.efforts ??
  offered?.effort.values.map((offer) => offer.value) ??
  []

export const effortFor = (offered: HarnessRunOptions, model: string, effort: string) => {
  const usable = usableEfforts(offered, model)
  if (usable.length === 0 || usable.includes(effort)) return effort
  const levels = offered.effort.values.map((offer) => offer.value)
  const lower = levels
    .slice(0, levels.indexOf(effort))
    .reverse()
    .find((level) => usable.includes(level))
  return lower ?? levels.find((level) => usable.includes(level)) ?? effort
}

export const shownRunOptions = (offered: HarnessRunOptions | null, options: RunOptions) =>
  RUN_OPTIONS.filter(
    (option) =>
      option !== "effort" || offered === null || usableEfforts(offered, options.model).length > 0,
  ).map((option) => ({ option, name: nameOf(offered, option, options[option]) }))

const changedRunOptions = (current: RunOptions, previous: RunOptions) =>
  RUN_OPTIONS.filter((option) => current[option] !== previous[option])

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
