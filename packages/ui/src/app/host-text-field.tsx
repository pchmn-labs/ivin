import type { TextFieldProps } from "@ivin/plugin-api/ui"
import { TextField } from "../core/components/text-field/text-field.tsx"

export function HostTextField({ onChange, onSubmit, onEscape, onBlur, ...rest }: TextFieldProps) {
  return (
    <TextField
      {...rest}
      onChange={(event) => onChange(event.target.value)}
      {...(onBlur !== undefined && { onBlur: () => onBlur() })}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit?.()
        if (event.key === "Escape" && onEscape !== undefined) {
          event.preventDefault()
          onEscape()
        }
      }}
    />
  )
}
