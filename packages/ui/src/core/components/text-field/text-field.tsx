import type { KeyboardEventHandler, ChangeEventHandler, FocusEventHandler } from "react"
import "./text-field.css"

interface FieldProps {
  readonly label: string
  readonly showLabel?: boolean
  readonly value: string
  readonly onChange: ChangeEventHandler<HTMLInputElement & HTMLTextAreaElement>
  readonly onKeyDown?: KeyboardEventHandler<HTMLInputElement & HTMLTextAreaElement>
  readonly onBlur?: FocusEventHandler<HTMLInputElement & HTMLTextAreaElement>
  readonly autoFocus?: boolean
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly "data-testid"?: string
}

export type TextFieldProps = FieldProps
export interface TextAreaProps extends FieldProps {
  readonly rows?: number
}

export function TextField({ label, showLabel, ...rest }: TextFieldProps) {
  const input = (
    <input
      {...rest}
      className="iv-field iv-field--input"
      type="text"
      aria-label={showLabel === true ? undefined : label}
    />
  )
  return showLabel === true ? <Labelled label={label}>{input}</Labelled> : input
}

export function TextArea({ label, showLabel, rows = 1, ...rest }: TextAreaProps) {
  const area = (
    <textarea
      {...rest}
      className="iv-field iv-field--area"
      rows={rows}
      aria-label={showLabel === true ? undefined : label}
    />
  )
  return showLabel === true ? <Labelled label={label}>{area}</Labelled> : area
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="iv-field-label">
      <span className="iv-field-label__text">{label}</span>
      {children}
    </label>
  )
}
