import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SettingSection } from "@ivin/contracts/setting"
import { useId, useState } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Select } from "../../../core/components/select/select.tsx"
import { Switch } from "../../../core/components/switch/switch.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { setSettingOf, shownSettingOf } from "../atoms/set-setting.ts"
import { settingsSectionAtom } from "../atoms/settings-page.ts"
import { countOf } from "../rules/count-of.ts"
import { settingsProblemAtom } from "../atoms/settings.ts"
import { settingsPageSections } from "../rules/settings-page-sections.ts"
import { CommandLineSection } from "./command-line-section.tsx"
import { SettingsFileProblem } from "./settings-file-problem.tsx"
import "./settings-page.css"

function CountField({
  setting,
  count,
  value,
  disabled,
  describedBy,
  save,
}: {
  setting: SettingSection["settings"][number]
  count: { readonly min: number; readonly unit: string }
  value: number
  disabled: boolean
  describedBy: string
  save: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const typed = draft ?? String(value)
  const invalid = draft !== null && countOf(draft, count.min) === null
  const invalidId = useId()
  const commit = () => {
    if (draft === null) return
    const next = countOf(draft, count.min)
    if (next === null) return
    setDraft(null)
    if (next !== value) save(next)
  }
  return (
    <div className="iv-settings-page__count">
      <div className="iv-settings-page__count-field">
        <TextField
          label={setting.label}
          value={typed}
          inputMode="numeric"
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${describedBy} ${invalidId}` : describedBy}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
            if (event.key === "Escape" && draft !== null) {
              event.stopPropagation()
              setDraft(null)
            }
          }}
        />
        <Text tone="muted">{count.unit}</Text>
      </div>
      {invalid && (
        <div id={invalidId}>
          <ErrorMessage message={`Enter a whole number of ${count.unit}, ${count.min} or more.`} />
        </div>
      )}
    </div>
  )
}

function SettingRow({
  setting,
  disabled,
}: {
  setting: SettingSection["settings"][number]
  disabled: boolean
}) {
  const shown = useAtomValue(shownSettingOf(setting.path))
  const save = useAtomSet(setSettingOf(setting.path))
  const descriptionId = useId()
  return (
    <li className="iv-settings-page__setting">
      <div className="iv-settings-page__setting-text">
        <Text weight="medium">{setting.label}</Text>
        <div id={descriptionId}>
          <Text size="sm" tone="muted">
            {setting.description}
          </Text>
        </div>
        <Text size="xs" tone="faint" mono>
          {setting.path}
        </Text>
        {shown.failure !== null && (
          <ErrorMessage
            message={shown.failure}
            onRetry={() =>
              save(
                setting.count !== undefined
                  ? Number(shown.value)
                  : setting.choices === undefined
                    ? shown.value === true
                    : String(shown.value),
              )
            }
          />
        )}
      </div>
      {setting.count !== undefined ? (
        <CountField
          setting={setting}
          count={setting.count}
          value={Number(shown.value)}
          disabled={disabled}
          describedBy={descriptionId}
          save={save}
        />
      ) : setting.choices === undefined ? (
        <Switch
          label={setting.label}
          checked={shown.value === true}
          disabled={disabled}
          onChange={save}
          aria-describedby={descriptionId}
        />
      ) : (
        <Select
          label={setting.label}
          value={String(shown.value)}
          options={setting.choices}
          disabled={disabled}
          onChange={save}
          aria-describedby={descriptionId}
        />
      )}
    </li>
  )
}

export function SettingsPage() {
  const selected = useAtomValue(settingsSectionAtom)
  const problem = useAtomValue(settingsProblemAtom)
  const section = settingsPageSections.find((s) => s.key === selected) ?? settingsPageSections[0]
  return (
    <div className="iv-settings-page">
      <section className="iv-settings-page__column" aria-labelledby="iv-settings-page-title">
        {problem !== null && <SettingsFileProblem problem={problem} />}
        <h2 className="iv-settings-page__title" id="iv-settings-page-title">
          {section.title}
        </h2>
        <Text tone="muted">{section.description}</Text>
        <ul className="iv-settings-page__list">
          {section.key === "commandLine" ? (
            <CommandLineSection />
          ) : (
            section.settings.map((setting) => (
              <SettingRow key={setting.path} setting={setting} disabled={problem !== null} />
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
