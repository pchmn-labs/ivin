import type { TextProps } from "@ivin/plugin-api/ui"
import "./text.css"

export type { TextProps }

export function Text({
  as: Tag = "span",
  size = "md",
  tone = "default",
  weight = "regular",
  mono = false,
  italic = false,
  preWrap = false,
  truncate = false,
  lines,
  children,
  ...rest
}: TextProps) {
  const classes = [
    "iv-text",
    `iv-text--${size}`,
    `iv-text--${tone}`,
    `iv-text--${weight}`,
    mono && "iv-text--mono",
    italic && "iv-text--italic",
    preWrap && "iv-text--pre-wrap",
    truncate && "iv-text--truncate",
    lines !== undefined && `iv-text--lines-${lines}`,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <Tag {...rest} className={classes}>
      {children}
    </Tag>
  )
}
