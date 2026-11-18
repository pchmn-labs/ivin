import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Brain,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Copy,
  DotsThree,
  File,
  FolderOpen,
  GitBranch,
  NotePencil,
  PencilSimple,
  Plus,
  Question,
  SidebarSimple,
  Sparkle,
  Stop,
  Terminal,
  User,
  WarningCircle,
  Wrench,
  X,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import type { IconProps as PluginIconProps } from "@ivin/plugin-api/ui"
import "./icon.css"

export type IconName = PluginIconProps["name"]
export type IconProps = PluginIconProps

const icons = {
  plus: Plus,
  "folder-open": FolderOpen,
  send: ArrowUp,
  square: Stop,
  check: Check,
  x: X,
  "chevron-down": CaretDown,
  "chevron-right": CaretRight,
  ellipsis: DotsThree,
  terminal: Terminal,
  file: File,
  pencil: PencilSimple,
  "circle-alert": WarningCircle,
  loader: CircleNotch,
  copy: Copy,
  "git-branch": GitBranch,
  brain: Brain,
  wrench: Wrench,
  user: User,
  sparkles: Sparkle,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "panel-left": SidebarSimple,
  "new-session": NotePencil,
  question: Question,
} satisfies Record<IconName, PhosphorIcon>

export function Icon({ name, size = 16, label }: IconProps) {
  const Glyph = icons[name]
  return (
    <Glyph
      className={name === "loader" ? "iv-icon iv-icon--spin" : "iv-icon"}
      size={size}
      weight="regular"
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : "img"}
    />
  )
}
