import { Icon } from "../icon/icon.tsx"
import "./select.css"

export interface SelectProps {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: ReadonlyArray<{ value: string; label: string }>
  readonly disabled?: boolean
  readonly "data-testid"?: string
  readonly "aria-describedby"?: string
}

export function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  "data-testid": testId,
  "aria-describedby": describedBy,
}: SelectProps) {
  return (
    <span className="iv-select">
      <select
        className="iv-select__control"
        aria-label={label}
        value={value}
        disabled={disabled}
        data-testid={testId}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="iv-select__chevron">
        <Icon name="chevron-down" size={12} />
      </span>
    </span>
  )
}
