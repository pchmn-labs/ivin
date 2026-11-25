import type { StackProps as PluginStackProps } from "@ivin/plugin-api/ui"
import "./stack.css"

export type StackProps = PluginStackProps & { readonly className?: string }

export function Stack({
  direction = "column",
  gap = 0,
  align,
  justify,
  wrap = false,
  grow = false,
  inset,
  padding,
  as: Tag = "div",
  className,
  children,
  ...rest
}: StackProps) {
  const classes = [
    "iv-stack",
    `iv-stack--${direction}`,
    `iv-stack--gap-${String(gap).replace(".", "-")}`,
    align && `iv-stack--align-${align}`,
    justify && `iv-stack--justify-${justify}`,
    wrap && "iv-stack--wrap",
    grow && "iv-stack--grow",
    inset && `iv-stack--inset-${inset}`,
    padding && `iv-stack--padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <Tag {...rest} className={classes}>
      {children}
    </Tag>
  )
}
