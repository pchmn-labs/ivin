import type { IconProps, ToolCallItem } from "@ivin/plugin-api/ui"

const ICONS: Readonly<Record<ToolCallItem["kind"], IconProps["name"]>> = {
  command: "terminal",
  read: "file",
  edit: "pencil",
  search: "search",
  skill: "sparkles",
  agent: "robot",
  other: "wrench",
}

export const toolIcon = (kind: ToolCallItem["kind"]): IconProps["name"] => ICONS[kind]
