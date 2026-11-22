import {
  AppWindow,
  Archive,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowsInLineVertical,
  Eye,
  EyeSlash,
  ArrowsLeftRight,
  ArrowsOut,
  ArrowUp,
  BracketsCurly,
  Brain,
  CaretDown,
  CaretRight,
  Check,
  CircleNotch,
  Clock,
  Copy,
  DotsThree,
  File,
  Folder,
  FolderOpen,
  Gear,
  GitBranch,
  GitDiff,
  GitFork,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Question,
  Robot,
  Plus,
  SidebarSimple,
  SquareSplitHorizontal,
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
  "arrows-out": ArrowsOut,
  split: SquareSplitHorizontal,
  gear: Gear,
  "brackets-curly": BracketsCurly,
  "app-window": AppWindow,
  "collapse-all": ArrowsInLineVertical,
  eye: Eye,
  "eye-slash": EyeSlash,
  clock: Clock,
  diff: GitDiff,
  question: Question,
} satisfies Record<IconName, PhosphorIcon>

// Drawn filled, as the session mark's status overlay is.
const FILLED: ReadonlySet<IconName> = new Set(["question"])

export function Icon({ name, size = 16, label }: IconProps) {
  const Glyph = icons[name]
  return (
    <Glyph
      className={name === "loader" ? "iv-icon iv-icon--spin" : "iv-icon"}
      size={size}
      weight={FILLED.has(name) ? "fill" : "regular"}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : "img"}
    />
  )
}
