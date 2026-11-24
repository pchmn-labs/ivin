import { Suspense, lazy, type ComponentType } from "react"
import type { Icon as PhosphorIcon, IconProps as PhosphorProps } from "@phosphor-icons/react"
import { ArchiveIcon as Archive } from "@phosphor-icons/react/dist/csr/Archive"
import { ArrowCounterClockwiseIcon as ArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise"
import { ArrowDownIcon as ArrowDown } from "@phosphor-icons/react/dist/csr/ArrowDown"
import { ArrowUpIcon as ArrowUp } from "@phosphor-icons/react/dist/csr/ArrowUp"
import { CaretDownIcon as CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown"
import { CaretRightIcon as CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight"
import { CheckIcon as Check } from "@phosphor-icons/react/dist/csr/Check"
import { CheckCircleIcon as CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle"
import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react/dist/csr/CircleNotch"
import { CopyIcon as Copy } from "@phosphor-icons/react/dist/csr/Copy"
import { DotsThreeIcon as DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree"
import { FileIcon as File } from "@phosphor-icons/react/dist/csr/File"
import { FolderIcon as Folder } from "@phosphor-icons/react/dist/csr/Folder"
import { FolderOpenIcon as FolderOpen } from "@phosphor-icons/react/dist/csr/FolderOpen"
import { GearIcon as Gear } from "@phosphor-icons/react/dist/csr/Gear"
import { GitBranchIcon as GitBranch } from "@phosphor-icons/react/dist/csr/GitBranch"
import { GitForkIcon as GitFork } from "@phosphor-icons/react/dist/csr/GitFork"
import { InfoIcon as Info } from "@phosphor-icons/react/dist/csr/Info"
import { MagnifyingGlassIcon as MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { NotePencilIcon as NotePencil } from "@phosphor-icons/react/dist/csr/NotePencil"
import { PencilSimpleIcon as PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple"
import { PlusIcon as Plus } from "@phosphor-icons/react/dist/csr/Plus"
import { SidebarSimpleIcon as SidebarSimple } from "@phosphor-icons/react/dist/csr/SidebarSimple"
import { StopIcon as Stop } from "@phosphor-icons/react/dist/csr/Stop"
import { TrashIcon as Trash } from "@phosphor-icons/react/dist/csr/Trash"
import { UserIcon as User } from "@phosphor-icons/react/dist/csr/User"
import { WarningIcon as Warning } from "@phosphor-icons/react/dist/csr/Warning"
import { WarningCircleIcon as WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X"
import { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft"
import { ArrowsOutIcon as ArrowsOut } from "@phosphor-icons/react/dist/csr/ArrowsOut"
import { BrainIcon as Brain } from "@phosphor-icons/react/dist/csr/Brain"
import { ClockIcon as Clock } from "@phosphor-icons/react/dist/csr/Clock"
import { GitDiffIcon as GitDiff } from "@phosphor-icons/react/dist/csr/GitDiff"
import { QuestionIcon as Question } from "@phosphor-icons/react/dist/csr/Question"
import { RobotIcon as Robot } from "@phosphor-icons/react/dist/csr/Robot"
import { SparkleIcon as Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle"
import { StackIcon as Stack } from "@phosphor-icons/react/dist/csr/Stack"
import { TerminalIcon as Terminal } from "@phosphor-icons/react/dist/csr/Terminal"
import { WrenchIcon as Wrench } from "@phosphor-icons/react/dist/csr/Wrench"
import { ArrowClockwiseIcon as ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise"
import { ArrowRightIcon as ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight"
import { ArrowSquareOutIcon as ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut"
import { SquareSplitHorizontalIcon as SquareSplitHorizontal } from "@phosphor-icons/react/dist/csr/SquareSplitHorizontal"
import type { IconProps as PluginIconProps } from "@ivin/plugin-api/ui"
import "./icon.css"

export type IconName = PluginIconProps["name"]
export type IconProps = PluginIconProps

// Drawn by the first screen, so in the main chunk.
const eagerIcons = {
  archive: Archive,
  trash: Trash,
  restore: ArrowCounterClockwise,
  plus: Plus,
  "folder-open": FolderOpen,
  send: ArrowUp,
  square: Stop,
  stop: Stop,
  check: Check,
  x: X,
  "chevron-down": CaretDown,
  "chevron-right": CaretRight,
  ellipsis: DotsThree,
  file: File,
  pencil: PencilSimple,
  "circle-alert": WarningCircle,
  exclamation: WarningCircle,
  "triangle-alert": Warning,
  "circle-info": Info,
  "circle-check": CheckCircle,
  loader: CircleNotch,
  copy: Copy,
  "git-branch": GitBranch,
  folder: Folder,
  worktree: GitFork,
  user: User,
  "arrow-down": ArrowDown,
  "panel-left": SidebarSimple,
  "new-session": NotePencil,
  search: MagnifyingGlass,
  gear: Gear,
  terminal: Terminal,
  brain: Brain,
  wrench: Wrench,
  sparkles: Sparkle,
  "arrow-left": ArrowLeft,
  stack: Stack,
  robot: Robot,
  "arrows-out": ArrowsOut,
  clock: Clock,
  diff: GitDiff,
  question: Question,
  "arrow-right": ArrowRight,
  split: SquareSplitHorizontal,
  restart: ArrowClockwise,
  "external-link": ArrowSquareOut,
} satisfies Partial<Record<IconName, PhosphorIcon>>

// Drawn only by settings and the Files and Changes panels; each loads the first time it is drawn.
const lazyIcons = {
  "brackets-curly": lazy(() =>
    import("@phosphor-icons/react/dist/csr/BracketsCurly").then((m) => ({
      default: m.BracketsCurlyIcon,
    })),
  ),
  "app-window": lazy(() =>
    import("@phosphor-icons/react/dist/csr/AppWindow").then((m) => ({ default: m.AppWindowIcon })),
  ),
  download: lazy(() =>
    import("@phosphor-icons/react/dist/csr/DownloadSimple").then((m) => ({
      default: m.DownloadSimpleIcon,
    })),
  ),
  "collapse-all": lazy(() =>
    import("@phosphor-icons/react/dist/csr/ArrowsInLineVertical").then((m) => ({
      default: m.ArrowsInLineVerticalIcon,
    })),
  ),
  eye: lazy(() =>
    import("@phosphor-icons/react/dist/csr/Eye").then((m) => ({ default: m.EyeIcon })),
  ),
  "eye-slash": lazy(() =>
    import("@phosphor-icons/react/dist/csr/EyeSlash").then((m) => ({ default: m.EyeSlashIcon })),
  ),
  undo: lazy(() =>
    import("@phosphor-icons/react/dist/csr/ArrowUUpLeft").then((m) => ({
      default: m.ArrowUUpLeftIcon,
    })),
  ),
  "arrows-left-right": lazy(() =>
    import("@phosphor-icons/react/dist/csr/ArrowsLeftRight").then((m) => ({
      default: m.ArrowsLeftRightIcon,
    })),
  ),
} satisfies Partial<Record<IconName, ComponentType<PhosphorProps>>>

// Fails to compile when a name is in neither map.
type Missing = Exclude<IconName, keyof typeof eagerIcons | keyof typeof lazyIcons>
const everyNameHasAGlyph: [Missing] extends [never] ? true : never = true
void everyNameHasAGlyph

// Drawn filled, as the session mark's status overlay is.
const FILLED: ReadonlySet<IconName> = new Set(["question", "exclamation", "stop"])

export function Icon({ name, size = 16, label }: IconProps) {
  const props = {
    className: name === "loader" ? "iv-icon iv-icon--spin" : "iv-icon",
    size,
    weight: FILLED.has(name) ? ("fill" as const) : ("regular" as const),
    "aria-hidden": label === undefined ? true : undefined,
    "aria-label": label,
    role: label === undefined ? undefined : "img",
  }
  if (name in eagerIcons) {
    const Glyph = eagerIcons[name as keyof typeof eagerIcons]
    return <Glyph {...props} />
  }
  const Glyph = lazyIcons[name as keyof typeof lazyIcons]
  return (
    <Suspense fallback={<svg className="iv-icon" width={size} height={size} aria-hidden />}>
      <Glyph {...props} />
    </Suspense>
  )
}
