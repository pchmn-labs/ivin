import {
  Archive,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowsLeftRight,
  ArrowUp,
  Brain,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Copy,
  DotsThree,
  File,
  Folder,
  FolderOpen,
  GitBranch,
  GitFork,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Robot,
  Plus,
  SidebarSimple,
  Sparkle,
  Stack,
  Stop,
  Terminal,
  Trash,
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
  archive: Archive,
  trash: Trash,
  restore: ArrowCounterClockwise,
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
  folder: Folder,
  worktree: GitFork,
  brain: Brain,
  wrench: Wrench,
  user: User,
  sparkles: Sparkle,
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrows-left-right": ArrowsLeftRight,
  "panel-left": SidebarSimple,
  "new-session": NotePencil,
  search: MagnifyingGlass,
  stack: Stack,
  robot: Robot,
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
