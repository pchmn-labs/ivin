import { createElement } from "react"
import type { ComponentType, ReactElement, ReactNode } from "react"
import type { GitFileStatus } from "@ivin/contracts/file"
import type { Session } from "@ivin/contracts/session"
import type { ImageRef } from "@ivin/contracts/transcript"
import { useHost } from "./host-context.ts"

export type IconName =
  | "archive"
  | "trash"
  | "restore"
  | "plus"
  | "folder-open"
  | "send"
  | "square"
  | "check"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "ellipsis"
  | "terminal"
  | "file"
  | "pencil"
  | "circle-alert"
  | "loader"
  | "copy"
  | "git-branch"
  | "folder"
  | "worktree"
  | "brain"
  | "wrench"
  | "user"
  | "sparkles"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrows-left-right"
  | "panel-left"
  | "new-session"
  | "search"
  | "stack"
  | "robot"
  | "arrows-out"
  | "split"
  | "gear"
  | "brackets-curly"
  | "app-window"
  | "collapse-all"
  | "eye"
  | "eye-slash"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "sm" | "md"

export interface ButtonProps {
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly icon?: IconName
  readonly disabled?: boolean
  readonly type?: "button" | "submit"
  readonly onClick?: () => void
  readonly children?: ReactNode
  readonly "aria-label"?: string
  readonly "aria-pressed"?: boolean
  readonly "aria-expanded"?: boolean
  readonly "data-testid"?: string
}

export interface IconButtonProps {
  readonly icon: IconName
  readonly label: string
  readonly tooltip?: string
  readonly size?: ButtonSize
  readonly variant?: ButtonVariant
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly "aria-expanded"?: boolean
  readonly "aria-pressed"?: boolean
  readonly "data-testid"?: string
}

export interface IconProps {
  readonly name: IconName
  readonly size?: 12 | 14 | 16 | 20
  readonly label?: string
}

export type MenuItem =
  | {
      readonly label: string
      readonly icon?: IconName
      readonly onSelect: () => void
      readonly danger?: boolean
      readonly disabled?: boolean
      // Makes the items that have it one choice, with a check on the chosen one.
      readonly checked?: boolean
      readonly hint?: string
    }
  | { readonly heading: string }
  | "separator"

export interface MenuProps {
  readonly trigger: ReactElement
  readonly items: ReadonlyArray<MenuItem>
  readonly align?: "start" | "end"
  readonly onOpenChange?: (open: boolean) => void
}

export interface DialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description?: string
  readonly children?: ReactNode
  readonly actions?: ReactNode
}

export interface TooltipProps {
  readonly content: string
  // A faint line above the content.
  readonly label?: string
  // Monospace and wrapped, for a command or a path.
  readonly mono?: boolean
  readonly children: ReactElement
  readonly side?: "top" | "right" | "bottom" | "left"
}

export interface TextProps {
  readonly as?: "p" | "span" | "div" | "strong" | "label"
  readonly size?: "xs" | "sm" | "md" | "lg"
  readonly tone?: "default" | "muted" | "faint" | "danger" | "attention" | "accent"
  readonly weight?: "regular" | "medium" | "semibold"
  readonly mono?: boolean
  readonly italic?: boolean
  readonly preWrap?: boolean
  readonly truncate?: boolean
  readonly title?: string
  readonly role?: string
  readonly "data-testid"?: string
  readonly children?: ReactNode
}

export interface StackProps {
  readonly direction?: "column" | "row"
  readonly gap?: 0 | 1 | 2 | 3 | 4 | 6 | 8
  readonly align?: "start" | "center" | "end" | "stretch" | "baseline"
  readonly justify?: "start" | "center" | "end" | "between"
  readonly wrap?: boolean
  readonly grow?: boolean
  readonly as?: "div" | "span" | "ul" | "li" | "section"
  readonly "data-testid"?: string
  readonly children?: ReactNode
}

export interface BlockProps {
  readonly tone?: "plain" | "subtle" | "accent" | "danger" | "bubble"
  readonly padding?: 2 | 3 | 4
  readonly role?: string
  readonly "data-testid"?: string
  readonly children?: ReactNode
}

export interface DisclosureProps {
  readonly summary: ReactNode
  readonly defaultOpen?: boolean
  // "section" heads a group of rows in a list, such as a sidebar section; "panel" heads a
  // sidebar panel, and its summary stays in view while the rows scroll.
  // "row" has no chevron: its summary brightens on hover and while open.
  readonly variant?: "default" | "section" | "panel" | "row"
  readonly "data-testid"?: string
  readonly children?: ReactNode
}

export interface CodeBlockProps {
  readonly text: string
  readonly "data-testid"?: string
}

export interface StatusMarkProps {
  readonly status: "working" | "waiting" | "idle" | "failed"
  readonly label: string
  readonly showLabel?: boolean
}

export interface ListRowProps {
  readonly leading?: ReactNode
  readonly title: ReactNode
  readonly subtitle?: ReactNode
  readonly meta?: ReactNode
  readonly selected?: boolean
  readonly attention?: boolean
  readonly onSelect?: () => void
  readonly actions?: ReactNode
  // Controls under the row, inside its frame and its hover.
  readonly below?: ReactNode
  // Shown on the row's right after a hover.
  readonly tooltip?: { readonly text: string; readonly label?: string; readonly mono?: boolean }
  readonly "aria-current"?: "page" | "true" | boolean
  readonly "data-testid"?: string
}

// A labelled list of rows; its children are `li` elements.
export interface ListSectionProps {
  readonly label: string
  readonly count?: number
  // Marks the label for sessions that wait on the user.
  readonly attention?: boolean
  readonly "data-testid"?: string
  readonly children?: ReactNode
}

// The session's harness mark, with its status over it and as its accessible name.
export interface SessionMarkProps {
  readonly status: Session["status"]
  readonly harness: Session["harness"]
}

// "now", "5 min", "3 d"…, kept current while shown.
export interface RelativeTimeProps {
  readonly at: Session["lastActivityAt"]
}

// The project's pixel creature, in its hue.
export interface ProjectMarkProps {
  readonly name: string
  readonly size?: 12 | 16 | 20
}

export interface MarkdownProps {
  readonly text: string
  // Links to files of this session's working folder open beside its chat.
  readonly sessionId?: string
}

export interface ActionSheetProps {
  // `danger` is announced as an alert.
  readonly tone?: "attention" | "danger" | "neutral"
  readonly icon?: IconName
  readonly title: string
  readonly detail?: string
  readonly hint?: string
  readonly children?: ReactNode
  readonly "data-testid"?: string
}

export interface OptionListProps {
  readonly label: string
  readonly options: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly hint?: string
  }>
  readonly value: string
  readonly onChange: (id: string) => void
  readonly onSubmit: (id: string) => void
  readonly onEscape?: () => void
  readonly submitOnClick?: boolean
  readonly disabled?: boolean
  readonly keyboardSource?: (target: EventTarget | null) => boolean
  /** Focuses the checked option on mount, unless a text field holds the focus. */
  readonly autoFocus?: boolean
}

export interface ErrorMessageProps {
  readonly message: string
  readonly onRetry?: () => void
  // Offered in place of Retry when the way out is another action.
  readonly action?: { readonly label: string; readonly onSelect: () => void }
  readonly "data-testid"?: string
}

// The images of a user's message, as thumbnails that open the full-screen view.
export interface MessageImagesProps {
  readonly sessionId: string
  readonly images: ReadonlyArray<ImageRef>
}

// A user's message text, with each `[Image #N]` drawn as its image's marker.
export interface MessageTextProps {
  readonly sessionId: string
  readonly text: string
  readonly images: ReadonlyArray<ImageRef>
}

export type TreeRowStatus = GitFileStatus | "ignored"

export interface TreeRow {
  readonly id: string
  readonly name: string
  readonly depth: number
  // Null for a row that holds nothing, such as a file.
  readonly expanded: boolean | null
  readonly status?: TreeRowStatus
  // The part of the name to highlight, as [start, end).
  readonly match?: readonly [number, number]
}

// A virtualised tree with VS Code's explorer keys and selection; it shows the rows given, so opening a row is the
// caller's: `onToggle` asks for it, and the rows given next include its children.
export interface TreeProps {
  readonly label: string
  readonly rows: ReadonlyArray<TreeRow>
  readonly onToggle: (id: string) => void
  // A click, Enter or Space on a row that holds nothing.
  readonly onOpen?: (id: string) => void
  // Selects this row and scrolls it into view each time it changes, once it is among the rows.
  readonly revealId?: string | null
  readonly "data-testid"?: string
}

export interface SearchFieldProps {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  // Escape empties a field that holds text; this runs on Escape in an empty one.
  readonly onEscape?: () => void
}

export interface QuickPickItem {
  readonly id: string
  readonly label: string
  // Positions of the label's characters to highlight.
  readonly match?: ReadonlyArray<number>
  // Faint mono text after the label, such as a folder.
  readonly detail?: string
  readonly status?: GitFileStatus
}

// A search field over a list of choices, in a popup at the top of the window; ↑ ↓ move, Enter picks, Escape closes.
export interface QuickPickProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly label: string
  readonly placeholder: string
  readonly query: string
  readonly onQueryChange: (query: string) => void
  readonly items: ReadonlyArray<QuickPickItem>
  readonly onPick: (id: string) => void
  // What shows in place of the list: no match, loading or a failure.
  readonly message?: ReactNode
  // Faint text at the right of the footer, such as a count.
  readonly footer?: string
}

export interface HostComponents {
  readonly Button: ComponentType<ButtonProps>
  readonly IconButton: ComponentType<IconButtonProps>
  readonly Icon: ComponentType<IconProps>
  readonly Menu: ComponentType<MenuProps>
  readonly Dialog: ComponentType<DialogProps>
  readonly Tooltip: ComponentType<TooltipProps>
  readonly Text: ComponentType<TextProps>
  readonly Stack: ComponentType<StackProps>
  readonly Block: ComponentType<BlockProps>
  readonly Disclosure: ComponentType<DisclosureProps>
  readonly CodeBlock: ComponentType<CodeBlockProps>
  readonly StatusMark: ComponentType<StatusMarkProps>
  readonly Markdown: ComponentType<MarkdownProps>
  readonly ActionSheet: ComponentType<ActionSheetProps>
  readonly OptionList: ComponentType<OptionListProps>
  readonly ErrorMessage: ComponentType<ErrorMessageProps>
  readonly ListRow: ComponentType<ListRowProps>
  readonly ListSection: ComponentType<ListSectionProps>
  readonly SessionMark: ComponentType<SessionMarkProps>
  readonly RelativeTime: ComponentType<RelativeTimeProps>
  readonly ProjectMark: ComponentType<ProjectMarkProps>
  readonly MessageImages: ComponentType<MessageImagesProps>
  readonly MessageText: ComponentType<MessageTextProps>
  readonly Tree: ComponentType<TreeProps>
  readonly SearchField: ComponentType<SearchFieldProps>
  readonly QuickPick: ComponentType<QuickPickProps>
}

const hostComponent =
  <P extends object>(pick: (components: HostComponents) => ComponentType<P>) =>
  (props: P) =>
    createElement(pick(useHost().components), props)

export const Button = hostComponent((c) => c.Button)
export const IconButton = hostComponent((c) => c.IconButton)
export const Icon = hostComponent((c) => c.Icon)
export const Menu = hostComponent((c) => c.Menu)
export const Dialog = hostComponent((c) => c.Dialog)
export const Tooltip = hostComponent((c) => c.Tooltip)
export const Text = hostComponent((c) => c.Text)
export const Stack = hostComponent((c) => c.Stack)
export const Block = hostComponent((c) => c.Block)
export const Disclosure = hostComponent((c) => c.Disclosure)
export const CodeBlock = hostComponent((c) => c.CodeBlock)
export const StatusMark = hostComponent((c) => c.StatusMark)
export const Markdown = hostComponent((c) => c.Markdown)
export const ActionSheet = hostComponent((c) => c.ActionSheet)
export const OptionList = hostComponent((c) => c.OptionList)
export const ErrorMessage = hostComponent((c) => c.ErrorMessage)
export const ListRow = hostComponent((c) => c.ListRow)
export const ListSection = hostComponent((c) => c.ListSection)
export const SessionMark = hostComponent((c) => c.SessionMark)
export const RelativeTime = hostComponent((c) => c.RelativeTime)
export const MessageImages = hostComponent((c) => c.MessageImages)
export const MessageText = hostComponent((c) => c.MessageText)
export const ProjectMark = hostComponent((c) => c.ProjectMark)
export const Tree = hostComponent((c) => c.Tree)
export const SearchField = hostComponent((c) => c.SearchField)
export const QuickPick = hostComponent((c) => c.QuickPick)
