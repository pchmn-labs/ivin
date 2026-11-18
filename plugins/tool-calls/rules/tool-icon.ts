import type { IconProps } from "@ivin/plugin-api/ui"

const ICONS: Readonly<Record<string, IconProps["name"]>> = {
  Bash: "terminal",
  Read: "file",
  Write: "pencil",
  Edit: "pencil",
  MultiEdit: "pencil",
}

export const toolIcon = (name: string): IconProps["name"] => ICONS[name] ?? "wrench"
