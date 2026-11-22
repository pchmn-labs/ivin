import { useAtom } from "@effect/atom-react"
import { useEffect, useRef, type KeyboardEvent } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon, type IconName } from "../../../core/components/icon/icon.tsx"
import { ListRow } from "../../../core/components/list-row/list-row.tsx"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { settingsSectionAtom } from "../atoms/settings-page.ts"
import { useOpenSettingsFile } from "../hooks/use-open-settings-file.ts"
import { SETTINGS_FILE } from "../rules/setting-message.ts"
import {
  settingsPageSections,
  type SettingsPageSectionKey,
} from "../rules/settings-page-sections.ts"
import "./settings-nav.css"

const sectionIcons: Record<SettingsPageSectionKey, IconName> = {
  tabs: "app-window",
  worktrees: "worktree",
  files: "folder",
  commandLine: "terminal",
}

const rowButtons = (list: HTMLElement) => [
  ...list.querySelectorAll<HTMLButtonElement>(".iv-list-row__main"),
]

export function SettingsNav({ onClose }: { onClose: () => void }) {
  const [selected, select] = useAtom(settingsSectionAtom)
  const list = useRef<HTMLUListElement>(null)
  const file = useOpenSettingsFile()
  const backHint = useKeyHint("Back to sessions", "settings.close")

  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
    const buttons = rowButtons(event.currentTarget)
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    const next = (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
    select(settingsPageSections[next]!.key)
    buttons[next]!.focus()
  }

  return (
    <nav className="iv-settings-nav" aria-label="Settings sections">
      <div className="iv-settings-nav__head">
        <IconButton
          icon="arrow-left"
          label="Back to sessions"
          tooltip={backHint}
          size="sm"
          onClick={onClose}
        />
        <h1 className="iv-settings-nav__title">Settings</h1>
      </div>
      <ul className="iv-settings-nav__list" ref={list} onKeyDown={onKeyDown}>
        {settingsPageSections.map((section) => (
          <li key={section.key}>
            <ListRow
              leading={<Icon name={sectionIcons[section.key]} size={14} />}
              title={section.title}
              selected={section.key === selected}
              onSelect={() => select(section.key)}
            />
          </li>
        ))}
      </ul>
      <div className="iv-settings-nav__foot">
        {file.failure !== null && <ErrorMessage message={file.failure} onRetry={file.open} />}
        <ListRow
          leading={<Icon name="brackets-curly" size={14} />}
          title="Open settings.json"
          onSelect={file.open}
          tooltip={{ text: SETTINGS_FILE, mono: true }}
        />
      </div>
    </nav>
  )
}
