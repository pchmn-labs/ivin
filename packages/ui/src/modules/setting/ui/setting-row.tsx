import type { SettingListProps, SettingRowProps } from "@ivin/plugin-api/ui"
import type { ReactNode } from "react"
import { Text } from "../../../core/components/text/text.tsx"
import "./settings-page.css"

export type { SettingRowProps }

export function SettingRow({
  title,
  description,
  descriptionId,
  control,
  below,
}: SettingRowProps & { readonly descriptionId?: string; readonly below?: ReactNode }) {
  return (
    <li className="iv-settings-page__setting">
      <div className="iv-settings-page__setting-text">
        <Text weight="medium">{title}</Text>
        {description === undefined ? null : (
          <div id={descriptionId}>
            <Text size="sm" tone="muted">
              {description}
            </Text>
          </div>
        )}
        {below}
      </div>
      {control}
    </li>
  )
}

export function SettingList({ children }: SettingListProps) {
  return <ul className="iv-settings-page__list">{children}</ul>
}
