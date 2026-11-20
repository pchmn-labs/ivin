import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { RunOption, Session } from "@ivin/contracts/session"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import {
  ComposerMenu,
  ComposerMenuNote,
} from "../../../core/components/composer-menu/composer-menu.tsx"
import { HarnessMark } from "../../../core/components/harness-mark/harness-mark.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { getHarnessAtom } from "../../server/atoms/get-harness.ts"
import { setRunOptionsAtom } from "../atoms/set-run-options.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { isRunning } from "../rules/is-running.ts"
import { RUN_OPTION_LABELS, RUN_OPTIONS, offeredValues } from "../rules/run-options.ts"
import "./run-option-menus.css"

export const RUN_OPTION_COMMANDS: Record<RunOption, string> = {
  model: "composer.chooseModel",
  effort: "composer.chooseEffort",
  permissionMode: "composer.choosePermissionMode",
}

export function RunOptionMenus({ session }: { session: Session }) {
  return (
    <span className="iv-run-option-menus">
      {RUN_OPTIONS.map((option) => (
        <RunOptionMenu key={option} session={session} option={option} />
      ))}
    </span>
  )
}

function RunOptionMenu({ session, option }: { session: Session; option: RunOption }) {
  const [open, setOpen] = useState(false)
  const harness = AsyncResult.getOrElse(useAtomValue(getHarnessAtom), () => null)
  const setRunOptions = useAtomSet(setRunOptionsAtom)
  useCommandHandler(RUN_OPTION_COMMANDS[option], () => setOpen(true))
  const current = session[option]
  const offered = harness?.id === session.harness ? harness.runOptions : null
  const label = RUN_OPTION_LABELS[option]

  return (
    <ComposerMenu
      label={label}
      open={open}
      onOpenChange={setOpen}
      searchPlaceholder="Find a value…"
      noMatch={(query) => `No value matches “${query}”.`}
      checkedLabel="Current"
      groups={[
        {
          items: offeredValues(offered, option, current).map((value) => ({
            value,
            key: value,
            label: value,
            checked: value === current,
            testId: `run-option-${option}-${value}`,
          })),
        },
      ]}
      onPick={(value) => {
        if (value === current) return
        setRunOptions({
          projectPath: session.projectPath,
          sessionId: session.id,
          options: { [option]: value },
        })
      }}
      trigger={
        <button
          type="button"
          className="iv-run-option-menus__trigger"
          data-testid={`run-option-${option}`}
          aria-label={`${label}: ${current}`}
        >
          {option === "model" && <HarnessMark mark={HARNESSES[session.harness].mark} size={14} />}
          <span className="iv-run-option-menus__value">{current}</span>
          <Icon name="chevron-down" size={12} />
        </button>
      }
    >
      {isRunning(session.status) && (
        <ComposerMenuNote>Applies from the next message.</ComposerMenuNote>
      )}
    </ComposerMenu>
  )
}
