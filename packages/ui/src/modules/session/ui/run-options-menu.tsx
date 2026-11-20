import { useAtomValue } from "@effect/atom-react"
import type { HarnessRunOptions, RunOption, RunOptions, Session } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import {
  ColumnMenu,
  ColumnMenuNote,
  type ColumnMenuColumn,
  type ColumnMenuItem,
} from "../../../core/components/column-menu/column-menu.tsx"
import { HarnessMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { getHarnessAtom } from "../../server/atoms/get-harness.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { isRunning } from "../rules/is-running.ts"
import {
  RUN_OPTION_LABELS,
  effortFor,
  nameOf,
  offeredValues,
  runOptionNames,
  usableEfforts,
} from "../rules/run-options.ts"
import "./run-options-menu.css"

export interface RunOptionsMenuState {
  readonly open: boolean
  readonly start: RunOption
}

const COMMANDS: Record<RunOption, string> = {
  model: "composer.chooseModel",
  effort: "composer.chooseEffort",
  permissionMode: "composer.choosePermissionMode",
}

const items = (
  offered: HarnessRunOptions | null,
  option: RunOption,
  current: string,
  disabled: (value: string) => boolean = () => false,
): ColumnMenuItem[] =>
  offeredValues(offered, option, current).map(({ value, name, description }) => ({
    value,
    label: name,
    description,
    checked: value === current,
    disabled: disabled(value),
    testId: `run-option-${option}-${value}`,
  }))

const columnsFor = (offered: HarnessRunOptions | null, session: Session): ColumnMenuColumn[] => {
  const models = items(offered, "model", session.model)
  const older = new Set(offered?.model.values.filter((m) => m.older).map((m) => m.value))
  const efforts = usableEfforts(offered, session.model)
  return [
    {
      key: "model",
      label: RUN_OPTION_LABELS.model,
      sections: [
        { items: models.filter((item) => !older.has(item.value)) },
        { label: "Older models", items: models.filter((item) => older.has(item.value)) },
      ].filter((section) => section.items.length > 0),
    },
    {
      key: "effort",
      label: RUN_OPTION_LABELS.effort,
      sections: [
        {
          items: items(
            offered,
            "effort",
            session.effort,
            (value) => offered !== null && !efforts.includes(value),
          ),
        },
      ],
      ...(offered !== null &&
        efforts.length === 0 && {
          note: `${nameOf(offered, "model", session.model)} has no effort setting.`,
        }),
    },
    {
      key: "permissionMode",
      label: RUN_OPTION_LABELS.permissionMode,
      wide: true,
      sections: [{ items: items(offered, "permissionMode", session.permissionMode) }],
    },
  ]
}

export function RunOptionsMenu({
  session,
  previous,
  state,
  onStateChange,
  onChange,
}: {
  session: Session
  // The options that last worked, when the agent failed after a change.
  previous: RunOptions | null
  state: RunOptionsMenuState
  onStateChange: (state: RunOptionsMenuState) => void
  onChange: (options: Partial<RunOptions>) => void
}) {
  const harness = AsyncResult.getOrElse(useAtomValue(getHarnessAtom), () => null)
  const offered = harness?.id === session.harness ? harness.runOptions : null
  useCommandHandler(COMMANDS.model, () => onStateChange({ open: true, start: "model" }))
  useCommandHandler(COMMANDS.effort, () => onStateChange({ open: true, start: "effort" }))
  useCommandHandler(COMMANDS.permissionMode, () =>
    onStateChange({ open: true, start: "permissionMode" }),
  )

  const pick = (column: string, value: string) => {
    const option = column as RunOption
    if (value === session[option]) return
    if (option !== "model" || offered === null) return onChange({ [option]: value })
    const effort = effortFor(offered, value, session.effort)
    onChange(effort === session.effort ? { model: value } : { model: value, effort })
  }

  const names = runOptionNames(offered, session)
  const shown = (["model", "effort", "permissionMode"] as const).filter(
    (option) => option !== "effort" || names.length === 3,
  )

  return (
    <ColumnMenu
      label="Run options"
      open={state.open}
      onOpenChange={(open) => onStateChange({ ...state, open })}
      startColumn={state.start}
      columns={columnsFor(offered, session)}
      onPick={pick}
      hint="Applies to this session from the next message"
      trigger={
        <button
          type="button"
          className="iv-run-options-menu__trigger"
          data-testid="run-options"
          aria-label={`Run options: ${names.join(", ")}`}
        >
          <HarnessMark mark={HARNESSES[session.harness].mark} size={14} />
          {shown.map((option, index) => (
            <span key={option} className="iv-run-options-menu__part">
              {index > 0 && <span className="iv-run-options-menu__sep">·</span>}
              <span
                className="iv-run-options-menu__value"
                data-changed={
                  (previous !== null && previous[option] !== session[option]) || undefined
                }
              >
                {names[index]}
              </span>
            </span>
          ))}
          <Icon name="chevron-down" size={12} />
        </button>
      }
    >
      {isRunning(session.status) && (
        <ColumnMenuNote>Applies once the agent finishes this turn.</ColumnMenuNote>
      )}
    </ColumnMenu>
  )
}
