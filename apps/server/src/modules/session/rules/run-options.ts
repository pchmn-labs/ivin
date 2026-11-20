import type { HarnessRunOptions, RunOptions } from "@ivin/contracts/session"
import type { RunOption } from "@ivin/contracts/transcript"

const OPTIONS: readonly RunOption[] = ["model", "effort", "permissionMode"]

export interface RunOptionChange {
  readonly option: RunOption
  readonly from: string
  readonly to: string
  readonly fromName: string
  readonly toName: string
}

const offers = (offered: HarnessRunOptions, option: RunOption, value: string) =>
  offered[option].values.some((offer) => offer.value === value)

// A value the harness no longer offers keeps its raw form.
const nameOf = (offered: HarnessRunOptions, option: RunOption, value: string) =>
  offered[option].values.find((offer) => offer.value === value)?.name ?? value

export const newSessionRunOptions = (
  offered: HarnessRunOptions,
  last: RunOptions | null,
): RunOptions => {
  const pick = (option: RunOption) => {
    const value = last?.[option]
    return value !== undefined && offers(offered, option, value) ? value : offered[option].default
  }
  return { model: pick("model"), effort: pick("effort"), permissionMode: pick("permissionMode") }
}

export const runOptionChanges = (
  current: RunOptions,
  requested: Partial<RunOptions>,
  offered: HarnessRunOptions,
): RunOptionChange[] =>
  OPTIONS.flatMap((option) => {
    const to = requested[option]
    const from = current[option]
    if (to === undefined || to === from) return []
    const fromName = nameOf(offered, option, from)
    return [{ option, from, to, fromName, toName: nameOf(offered, option, to) }]
  })

export const sameRunOptions = (a: RunOptions, b: RunOptions) =>
  OPTIONS.every((option) => a[option] === b[option])

export const runOptionsOf = ({ model, effort, permissionMode }: RunOptions): RunOptions => ({
  model,
  effort,
  permissionMode,
})
