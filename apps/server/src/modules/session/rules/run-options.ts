import type { HarnessRunOptions, RunOption, RunOptions } from "@ivin/contracts/session"

const OPTIONS: readonly RunOption[] = ["model", "effort", "permissionMode"]

export interface RunOptionChange {
  readonly option: RunOption
  readonly from: string
  readonly to: string
}

export const newSessionRunOptions = (
  offered: HarnessRunOptions,
  last: RunOptions | null,
): RunOptions => {
  const pick = (option: RunOption) => {
    const value = last?.[option]
    return value !== undefined && offered[option].values.includes(value)
      ? value
      : offered[option].default
  }
  return { model: pick("model"), effort: pick("effort"), permissionMode: pick("permissionMode") }
}

export const runOptionChanges = (
  current: RunOptions,
  requested: Partial<RunOptions>,
): RunOptionChange[] =>
  OPTIONS.flatMap((option) => {
    const to = requested[option]
    return to === undefined || to === current[option] ? [] : [{ option, from: current[option], to }]
  })

export const sameRunOptions = (a: RunOptions, b: RunOptions) =>
  OPTIONS.every((option) => a[option] === b[option])

export const runOptionsOf = ({ model, effort, permissionMode }: RunOptions): RunOptions => ({
  model,
  effort,
  permissionMode,
})
