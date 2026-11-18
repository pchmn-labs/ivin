import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  Ellipsis,
  File,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  Terminal,
  User,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"
import type { IconProps as PluginIconProps } from "@ivin/plugin-api/ui"
import "./icon.css"

export type IconName = PluginIconProps["name"]
export type IconProps = PluginIconProps

const icons = {
  plus: Plus,
  "folder-open": FolderOpen,
  send: Send,
  square: Square,
  check: Check,
  x: X,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  ellipsis: Ellipsis,
  terminal: Terminal,
  file: File,
  pencil: Pencil,
  "circle-alert": CircleAlert,
  loader: LoaderCircle,
  copy: Copy,
  "git-branch": GitBranch,
  brain: Brain,
  wrench: Wrench,
  user: User,
  sparkles: Sparkles,
} satisfies Record<IconName, LucideIcon>

export function Icon({ name, size = 16, label }: IconProps) {
  const Glyph = icons[name]
  return (
    <Glyph
      className={name === "loader" ? "iv-icon iv-icon--spin" : "iv-icon"}
      size={size}
      strokeWidth={1.75}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : "img"}
    />
  )
}
