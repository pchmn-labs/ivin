import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import "./segmented.css"

export interface SegmentedProps<V extends string> {
  readonly label: string
  readonly options: ReadonlyArray<{ readonly value: V; readonly label: string }>
  readonly value: V
  readonly onChange: (value: V) => void
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<V>) {
  return (
    <ToggleGroup
      className="iv-segmented"
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const [picked] = next as ReadonlyArray<V>
        if (picked !== undefined) onChange(picked)
      }}
    >
      {options.map((option) => (
        <Toggle key={option.value} value={option.value} className="iv-segmented__option">
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
