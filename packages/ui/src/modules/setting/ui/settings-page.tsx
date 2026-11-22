import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { SettingSection } from "@ivin/contracts/setting"
import { useId } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Switch } from "../../../core/components/switch/switch.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { setSettingOf, shownSettingOf } from "../atoms/set-setting.ts"
import { settingsSectionAtom } from "../atoms/settings-page.ts"
import { settingsProblemAtom } from "../atoms/settings.ts"
import { settingsPageSections } from "../rules/settings-page-sections.ts"
import { CommandLineSection } from "./command-line-section.tsx"
import { SettingsFileProblem } from "./settings-file-problem.tsx"
import "./settings-page.css"

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
          <ErrorMessage message={shown.failure} onRetry={() => save(shown.value === true)} />
        )}
      </div>
      <Switch
        label={setting.label}
        checked={shown.value === true}
        disabled={disabled}
        onChange={save}
        aria-describedby={descriptionId}
      />
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
