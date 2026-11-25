import { Suspense, lazy, type ComponentType } from "react"
import archive from "@phosphor-icons/core/assets/regular/archive.svg?raw"
import trash from "@phosphor-icons/core/assets/regular/trash.svg?raw"
import arrowCounterClockwise from "@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw"
import plus from "@phosphor-icons/core/assets/regular/plus.svg?raw"
import folderOpen from "@phosphor-icons/core/assets/regular/folder-open.svg?raw"
import arrowUp from "@phosphor-icons/core/assets/regular/arrow-up.svg?raw"
import stop from "@phosphor-icons/core/assets/regular/stop.svg?raw"
import stopFill from "@phosphor-icons/core/assets/fill/stop-fill.svg?raw"
import check from "@phosphor-icons/core/assets/regular/check.svg?raw"
import x from "@phosphor-icons/core/assets/regular/x.svg?raw"
import caretDown from "@phosphor-icons/core/assets/regular/caret-down.svg?raw"
import caretRight from "@phosphor-icons/core/assets/regular/caret-right.svg?raw"
import dotsThree from "@phosphor-icons/core/assets/regular/dots-three.svg?raw"
import file from "@phosphor-icons/core/assets/regular/file.svg?raw"
import pencilSimple from "@phosphor-icons/core/assets/regular/pencil-simple.svg?raw"
import warningCircle from "@phosphor-icons/core/assets/regular/warning-circle.svg?raw"
import warningCircleFill from "@phosphor-icons/core/assets/fill/warning-circle-fill.svg?raw"
import warning from "@phosphor-icons/core/assets/regular/warning.svg?raw"
import info from "@phosphor-icons/core/assets/regular/info.svg?raw"
import checkCircle from "@phosphor-icons/core/assets/regular/check-circle.svg?raw"
import circleNotch from "@phosphor-icons/core/assets/regular/circle-notch.svg?raw"
import copy from "@phosphor-icons/core/assets/regular/copy.svg?raw"
import gitBranch from "@phosphor-icons/core/assets/regular/git-branch.svg?raw"
import folder from "@phosphor-icons/core/assets/regular/folder.svg?raw"
import gitFork from "@phosphor-icons/core/assets/regular/git-fork.svg?raw"
import user from "@phosphor-icons/core/assets/regular/user.svg?raw"
import arrowDown from "@phosphor-icons/core/assets/regular/arrow-down.svg?raw"
import sidebarSimple from "@phosphor-icons/core/assets/regular/sidebar-simple.svg?raw"
import notePencil from "@phosphor-icons/core/assets/regular/note-pencil.svg?raw"
import magnifyingGlass from "@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw"
import gear from "@phosphor-icons/core/assets/regular/gear.svg?raw"
import terminal from "@phosphor-icons/core/assets/regular/terminal.svg?raw"
import brain from "@phosphor-icons/core/assets/regular/brain.svg?raw"
import wrench from "@phosphor-icons/core/assets/regular/wrench.svg?raw"
import sparkle from "@phosphor-icons/core/assets/regular/sparkle.svg?raw"
import arrowLeft from "@phosphor-icons/core/assets/regular/arrow-left.svg?raw"
import stack from "@phosphor-icons/core/assets/regular/stack.svg?raw"
import robot from "@phosphor-icons/core/assets/regular/robot.svg?raw"
import arrowsOut from "@phosphor-icons/core/assets/regular/arrows-out.svg?raw"
import clock from "@phosphor-icons/core/assets/regular/clock.svg?raw"
import gitDiff from "@phosphor-icons/core/assets/regular/git-diff.svg?raw"
import questionFill from "@phosphor-icons/core/assets/fill/question-fill.svg?raw"
import arrowRight from "@phosphor-icons/core/assets/regular/arrow-right.svg?raw"
import squareSplitHorizontal from "@phosphor-icons/core/assets/regular/square-split-horizontal.svg?raw"
import arrowClockwise from "@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw"
import arrowSquareOut from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw"
import type { IconProps as PluginIconProps } from "@ivin/plugin-api/ui"
import "./icon.css"

export type IconName = PluginIconProps["name"]
export type IconProps = PluginIconProps

interface SvgProps {
  readonly className: string
  readonly size: number
  readonly "aria-hidden": true | undefined
  readonly "aria-label": string | undefined
  readonly role: "img" | undefined
}

// The files are `<svg …>…</svg>` on one line; only the inside is kept, the wrapper is drawn below.
const innerOf = (svg: string) => svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"))

function Svg({ inner, size, ...rest }: SvgProps & { inner: string }) {
  return (
    <svg
      {...rest}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

function lazyGlyph(load: () => Promise<{ default: string }>) {
  return lazy(async () => {
    const inner = innerOf((await load()).default)
    return { default: (props: SvgProps) => <Svg inner={inner} {...props} /> }
  })
}

// Drawn by the first screen, so in the main chunk.
const eagerIcons = {
  archive: archive,
  trash: trash,
  restore: arrowCounterClockwise,
  plus: plus,
  "folder-open": folderOpen,
  send: arrowUp,
  square: stop,
  stop: stopFill,
  check: check,
  x: x,
  "chevron-down": caretDown,
  "chevron-right": caretRight,
  ellipsis: dotsThree,
  file: file,
  pencil: pencilSimple,
  "circle-alert": warningCircle,
  exclamation: warningCircleFill,
  "triangle-alert": warning,
  "circle-info": info,
  "circle-check": checkCircle,
  loader: circleNotch,
  copy: copy,
  "git-branch": gitBranch,
  folder: folder,
  worktree: gitFork,
  user: user,
  "arrow-down": arrowDown,
  "panel-left": sidebarSimple,
  "new-session": notePencil,
  search: magnifyingGlass,
  gear: gear,
  terminal: terminal,
  brain: brain,
  wrench: wrench,
  sparkles: sparkle,
  "arrow-left": arrowLeft,
  stack: stack,
  robot: robot,
  "arrows-out": arrowsOut,
  clock: clock,
  diff: gitDiff,
  question: questionFill,
  "arrow-right": arrowRight,
  split: squareSplitHorizontal,
  restart: arrowClockwise,
  "external-link": arrowSquareOut,
} satisfies Partial<Record<IconName, string>>

// Drawn only by settings and the Files and Changes panels; each loads the first time it is drawn.
const lazyIcons = {
  "brackets-curly": lazyGlyph(
    () => import("@phosphor-icons/core/assets/regular/brackets-curly.svg?raw"),
  ),
  "app-window": lazyGlyph(() => import("@phosphor-icons/core/assets/regular/app-window.svg?raw")),
  download: lazyGlyph(() => import("@phosphor-icons/core/assets/regular/download-simple.svg?raw")),
  "collapse-all": lazyGlyph(
    () => import("@phosphor-icons/core/assets/regular/arrows-in-line-vertical.svg?raw"),
  ),
  lock: lazyGlyph(() => import("@phosphor-icons/core/assets/regular/lock.svg?raw")),
  eye: lazyGlyph(() => import("@phosphor-icons/core/assets/regular/eye.svg?raw")),
  "eye-slash": lazyGlyph(() => import("@phosphor-icons/core/assets/regular/eye-slash.svg?raw")),
  undo: lazyGlyph(() => import("@phosphor-icons/core/assets/regular/arrow-u-up-left.svg?raw")),
  "arrows-left-right": lazyGlyph(
    () => import("@phosphor-icons/core/assets/regular/arrows-left-right.svg?raw"),
  ),
} satisfies Partial<Record<IconName, ComponentType<SvgProps>>>

// Fails to compile when a name is in neither map.
type Missing = Exclude<IconName, keyof typeof eagerIcons | keyof typeof lazyIcons>
const everyNameHasAGlyph: [Missing] extends [never] ? true : never = true
void everyNameHasAGlyph

export function Icon({ name, size = 16, label }: IconProps) {
  const props: SvgProps = {
    className: name === "loader" ? "iv-icon iv-icon--spin" : "iv-icon",
    size,
    "aria-hidden": label === undefined ? true : undefined,
    "aria-label": label,
    role: label === undefined ? undefined : "img",
  }
  if (name in eagerIcons) {
    return <Svg inner={innerOf(eagerIcons[name as keyof typeof eagerIcons])} {...props} />
  }
  const Glyph = lazyIcons[name as keyof typeof lazyIcons]
  return (
    <Suspense fallback={<svg className="iv-icon" width={size} height={size} aria-hidden />}>
      <Glyph {...props} />
    </Suspense>
  )
}
