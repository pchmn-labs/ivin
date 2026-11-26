import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import type { ChipsProps } from "@ivin/plugin-api/ui"
import "./chips.css"

export type { ChipsProps }

export function Chips({ label, options, value, onChange }: ChipsProps) {
  return (
    <ToggleGroup
      className="iv-chips"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const [picked] = next
        if (picked !== undefined) onChange(picked)
      }}
    >
      {options.map((option) => (
        <Toggle key={option.value} value={option.value} className="iv-chips__option">
          {option.label}
          <span className="iv-chips__count">{option.count}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
