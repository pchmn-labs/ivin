import { Switch as BaseSwitch } from "@base-ui/react/switch"
import "./switch.css"

export interface SwitchProps {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly disabled?: boolean
  readonly "aria-describedby"?: string
}

export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  "aria-describedby": describedBy,
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      className="iv-switch"
      aria-label={label}
      aria-describedby={describedBy}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next) => onChange(next)}
    >
      <BaseSwitch.Thumb className="iv-switch__thumb" />
    </BaseSwitch.Root>
  )
}
