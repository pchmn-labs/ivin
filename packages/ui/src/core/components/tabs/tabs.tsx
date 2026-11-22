import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import type { ReactNode } from "react"
import { Icon, type IconName } from "../icon/icon.tsx"
import "./tabs.css"

export interface TabsProps {
  readonly tabs: ReadonlyArray<{
    value: string
    label: string
    icon?: IconName
    // After the label, in faint tabular figures, such as a count.
    badge?: ReactNode
  }>
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly children?: ReactNode
  readonly "aria-label": string
}

export function Tabs({ tabs, value, onValueChange, children, "aria-label": ariaLabel }: TabsProps) {
  return (
    <BaseTabs.Root
      className="iv-tabs"
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
    >
      <BaseTabs.List className="iv-tabs__list" aria-label={ariaLabel} activateOnFocus>
        {tabs.map((tab) => (
          <BaseTabs.Tab key={tab.value} value={tab.value} className="iv-tabs__tab">
            {tab.icon === undefined ? null : <Icon name={tab.icon} size={14} />}
            {tab.label}
            {tab.badge === undefined ? null : <span className="iv-tabs__badge">{tab.badge}</span>}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {children === undefined ? null : (
        <BaseTabs.Panel value={value} className="iv-tabs__panel">
          {children}
        </BaseTabs.Panel>
      )}
    </BaseTabs.Root>
  )
}
