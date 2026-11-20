import { createElement } from "react"
import type { ComponentType, ReactElement, ReactNode } from "react"
import type { Session } from "@ivin/contracts/session"
import { useHost } from "./host-context.ts"

export type IconName =
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
  | "arrow-left"
  | "arrow-right"
  | "panel-left"
  | "new-session"

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
  readonly variant?: "default" | "section" | "panel"
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
}

export interface ActionSheetProps {
  readonly tone?: "attention" | "neutral"
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
  readonly "data-testid"?: string
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
export const ProjectMark = hostComponent((c) => c.ProjectMark)
