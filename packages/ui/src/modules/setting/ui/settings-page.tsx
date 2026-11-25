import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useId, useState } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Select } from "../../../core/components/select/select.tsx"
import { Switch } from "../../../core/components/switch/switch.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { contributionsAtom } from "../../plugin/atoms/contributions.ts"
import { SlotContribution } from "../../../app/slot-renderer.tsx"
import { setSettingOf, shownSettingOf } from "../atoms/set-setting.ts"
import { settingsPageSectionsAtom, settingsSectionAtom } from "../atoms/settings-page.ts"
import { countOf } from "../rules/count-of.ts"
import { settingsProblemAtom } from "../atoms/settings.ts"
import { ignoredPluginSettingMessage } from "../rules/setting-message.ts"
import type { PageSetting } from "../rules/settings-page-sections.ts"
import { CommandLineSection } from "./command-line-section.tsx"
import { ImagesSection } from "./images-section.tsx"
import { SettingsFileProblem } from "./settings-file-problem.tsx"
import "./settings-page.css"

function DraftField<Value extends number | string>({
  label,
  value,
  parse,
  invalidMessage,
  suffix,
  numeric,
  disabled,
  describedBy,
  save,
}: {
  label: string
  value: Value
  // Null when the typed text is not acceptable.
  parse: (draft: string) => Value | null
  invalidMessage: string
  suffix?: string
  numeric?: boolean
  disabled: boolean
  describedBy: string
  save: (value: Value) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const typed = draft ?? String(value)
  const invalid = draft !== null && parse(draft) === null
  const invalidId = useId()
  const commit = () => {
    if (draft === null) return
    const next = parse(draft)
    if (next === null) return
    setDraft(null)
    if (next !== value) save(next)
  }
  return (
    <div className="iv-settings-page__count">
      <div className="iv-settings-page__count-field">
        <TextField
          label={label}
          value={typed}
          {...(numeric === true && { inputMode: "numeric" as const })}
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
        {suffix !== undefined && <Text tone="muted">{suffix}</Text>}
      </div>
      {invalid && (
        <div id={invalidId}>
          <ErrorMessage message={invalidMessage} />
        </div>
      )}
    </div>
  )
}

const numberOf = (draft: string): number | null => {
  const trimmed = draft.trim()
  return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : null
}

function SettingRow({ setting, disabled }: { setting: PageSetting; disabled: boolean }) {
  const shown = useAtomValue(shownSettingOf(setting.path))
  const save = useAtomSet(setSettingOf(setting.path))
  const descriptionId = useId()
  const type = setting.plugin?.type
  const control =
    setting.count !== undefined
      ? "count"
      : setting.choices !== undefined
        ? "choice"
        : type === "number"
          ? "number"
          : type === "string"
            ? "text"
            : "switch"
  return (
    <li className="iv-settings-page__setting">
      <div className="iv-settings-page__setting-text">
        <Text weight="medium">{setting.label}</Text>
        <div id={descriptionId}>
          <Text size="sm" tone="muted">
            {setting.description}
          </Text>
        </div>
        <div className="iv-settings-page__path">
          <Text size="xs" tone="faint" mono>
            {setting.path}
          </Text>
        </div>
        {setting.plugin?.ignored === true && (
          <Text size="sm" tone="muted">
            {ignoredPluginSettingMessage(setting.plugin)}
          </Text>
        )}
        {shown.failure !== null && (
          <ErrorMessage
            message={shown.failure}
            onRetry={() =>
              save(
                control === "count" || control === "number"
                  ? Number(shown.value)
                  : control === "switch"
                    ? shown.value === true
                    : String(shown.value),
              )
            }
          />
        )}
      </div>
      {control === "count" && setting.count !== undefined ? (
        <DraftField
          label={setting.label}
          value={Number(shown.value)}
          parse={(draft) => countOf(draft, setting.count!.min)}
          invalidMessage={`Enter a whole number of ${setting.count.unit}, ${setting.count.min} or more.`}
          suffix={setting.count.unit}
          numeric
          disabled={disabled}
          describedBy={descriptionId}
          save={save}
        />
      ) : control === "number" ? (
        <DraftField
          label={setting.label}
          value={Number(shown.value)}
          parse={numberOf}
          invalidMessage="Enter a number."
          disabled={disabled}
          describedBy={descriptionId}
          save={save}
        />
      ) : control === "text" ? (
        <DraftField
          label={setting.label}
          value={String(shown.value)}
          parse={(draft) => draft}
          invalidMessage=""
          disabled={disabled}
          describedBy={descriptionId}
          save={save}
        />
      ) : control === "switch" ? (
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
          options={setting.choices ?? []}
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
  const sections = useAtomValue(settingsPageSectionsAtom)
  const contributions = useAtomValue(contributionsAtom)
  const section = sections.find((s) => s.key === selected) ?? sections[0]!
  const own = contributions.filter(
    (c) => c.slot === "settings.section" && c.pluginId === section.pluginId,
  )
  return (
    <div className="iv-settings-page">
      <section className="iv-settings-page__column" aria-labelledby="iv-settings-page-title">
        {problem !== null && <SettingsFileProblem problem={problem} />}
        <h2 className="iv-settings-page__title" id="iv-settings-page-title">
          {section.title}
        </h2>
        <Text tone="muted">{section.description}</Text>
        {own.length > 0 ? (
          own.map((contribution) => (
            <SlotContribution key={contribution.id} contribution={contribution} props={{}} />
          ))
        ) : (
          <ul className="iv-settings-page__list">
            {section.key === "commandLine" ? (
              <CommandLineSection />
            ) : section.key === "images" ? (
              <ImagesSection />
            ) : (
              section.settings.map((setting) => (
                <SettingRow key={setting.path} setting={setting} disabled={problem !== null} />
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
