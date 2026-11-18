import type { ButtonProps as PluginButtonProps, IconButtonProps } from "@ivin/plugin-api/ui"
import { Icon } from "../icon/icon.tsx"
import { Tooltip } from "../tooltip/tooltip.tsx"
import "./button.css"

export type ButtonProps = PluginButtonProps
export type { IconButtonProps }

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  disabled,
  type = "button",
  onClick,
  children,
  ...aria
}: ButtonProps) {
  return (
    <button
      {...aria}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`iv-button iv-button--${variant} iv-button--${size}`}
    >
      {icon === undefined ? null : <Icon name={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  onClick,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        {...rest}
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`iv-button iv-button--icon iv-button--${variant} iv-button--${size}`}
      >
        <Icon name={icon} size={size === "sm" ? 14 : 16} />
      </button>
    </Tooltip>
  )
}
