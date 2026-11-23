import { createElement } from "react"
import type { ComponentType, ReactNode } from "react"
import type { Extension as EditorExtension } from "@codemirror/state"
import type {
  Annotation,
  AnnotationDataOf,
  AnnotationTarget,
  IssueAnnotationData,
  PrAnnotationData,
} from "@ivin/contracts/annotation"
import type {
  Change,
  ChangeStatus,
  FolderEntry,
  GitFileStatus,
  GitStatusEntry,
} from "@ivin/contracts/file"
import type { OpenProjects, Project } from "@ivin/contracts/project"
import type {
  HarnessRunOptions,
  OfferedValue,
  RunOptions,
  Session,
  SessionStatus,
} from "@ivin/contracts/session"
import type { Settings } from "@ivin/contracts/setting"
import type { Tab } from "@ivin/contracts/tab"
import type {
  Question,
  QuestionAnswer,
  RunOption,
  SessionUsage,
  TranscriptItem,
} from "@ivin/contracts/transcript"
import { HostContext, useHost } from "./host-context.ts"
import type {
  ActionError,
  ActionFailure,
  CommittedChangeListing,
  ChangeListing,
  DiscardFailure,
  Draft,
  DraftImage,
  FileListing,
  FolderListing,
  SessionLocationLabel,
  UiHost,
} from "./host-context.ts"

export type {
  Annotation,
  Change,
  ChangeStatus,
  EditorExtension,
  AnnotationTarget,
  FolderEntry,
  GitFileStatus,
  GitStatusEntry,
  HarnessRunOptions,
  IssueAnnotationData,
  OfferedValue,
  OpenProjects,
  PrAnnotationData,
  Project,
  RunOption,
  RunOptions,
  Session,
  SessionStatus,
  SessionUsage,
  Settings,
  Tab,
  TranscriptItem,
}
// The data of a kind defined in contracts has that kind's shape; any other kind's is JSON.
export type AnnotationOf<K extends string> = Omit<Annotation, "data"> & {
  readonly data: AnnotationDataOf<K>
}
export type MessageItem = Extract<TranscriptItem, { type: "message" }>
export type ThinkingItem = Extract<TranscriptItem, { type: "thinking" }>
export type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
export type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
export type QuestionItem = Extract<TranscriptItem, { type: "question" }>
export type { Question, QuestionAnswer }
export type ErrorItem = Extract<TranscriptItem, { type: "error" }>
export type InterruptionItem = Extract<TranscriptItem, { type: "interruption" }>
export type WorkingFolderItem = Extract<TranscriptItem, { type: "working_folder" }>
export type RunOptionItem = Extract<TranscriptItem, { type: "run_option" }>
export type MessageSlotItem =
  | MessageItem
  | ThinkingItem
  | ErrorItem
  | InterruptionItem
  | WorkingFolderItem
  | RunOptionItem

export interface SlotProps {
  "transcript.message": { readonly item: MessageSlotItem; readonly sessionId: string }
  "transcript.toolCall": { readonly item: ToolCallItem; readonly sessionId: string }
  "transcript.approval": { readonly item: ApprovalItem; readonly sessionId: string }
  "transcript.question": { readonly item: QuestionItem; readonly sessionId: string }
  // The composer under the session's transcript, mounted again when the tab shows another session.
  "session.composer": { readonly sessionId: string }
  "composer.status": { readonly sessionId: string }
  "composer.above": {
    readonly session: Session
    readonly isEmptyComposer: (target: EventTarget | null) => boolean
  }
  // A section at the bottom of the selected project's sidebar column.
  "sidebar.section": Record<string, never>
  // A panel across the bottom of the sidebar card, under the projects and the sessions.
  "sidebar.bottom": Record<string, never>
  // A tab of the sidebar's list column, beside Sessions, named by the contribution's `title`.
  "sidebar.panel": Record<string, never>
  // Mounted once in the window while a project is open, for a popup such as a quick pick.
  "window.overlay": Record<string, never>
}
export type SlotName = keyof SlotProps

export interface SlotOptions {
  readonly order?: number
  readonly name?: string
  readonly replaces?: string
  readonly tool?: string
  // The tab's name, for a `sidebar.panel` contribution.
  readonly title?: string
  // Shown after a `sidebar.panel` tab's name, such as a count; it renders nothing to show none.
  readonly badge?: ComponentType
}

export interface CommandOptions {
  readonly title: string
  // A rejected promise shows its command's title as a notification.
  readonly run: () => unknown
}

export type NotificationKind = "error" | "warning" | "info" | "success"

export interface NotifyOptions {
  // Defaults to "error".
  readonly kind?: NotificationKind
  readonly message: string
  readonly action?: { readonly label: string; readonly onClick: () => void }
}

export interface KeybindingOptions {
  // `mod` is ⌘ on macOS and Ctrl elsewhere: "mod+shift+p", "escape".
  readonly key: string
  readonly command: string
  // An area of the window, such as "composer"; everywhere when absent.
  readonly when?: string
}

export interface FileIconRow {
  readonly name: string
  readonly folder: boolean
  readonly open: boolean
}

// Null leaves the row to the next `fileIcons` contribution, then to the `Tree`'s own icon.
export type FileIcon = (row: FileIconRow) => ReactNode | null

export interface UiContext {
  readonly pluginId: string
  readonly slots: {
    add: <S extends SlotName>(
      slot: S,
      component: ComponentType<SlotProps[S]>,
      options?: SlotOptions,
    ) => void
  }
  readonly commands: {
    register: (id: string, command: CommandOptions) => void
  }
  // A temporary notification in the window, for what has no place of its own on screen.
  readonly notify: (notification: NotifyOptions) => void
  // A default keybinding, which the user's ~/.ivin/keybindings.json can change.
  readonly keybindings: {
    add: (keybinding: KeybindingOptions) => void
  }
  // CodeMirror extensions for the editor of every open file, built from `@ivin/plugin-api/editor`.
  readonly editorExtensions: {
    add: (extension: EditorExtension) => void
  }
  // The icon of each row of the Files tab's tree; an `<img>` is drawn at `--iv-tree-icon-size`.
  readonly fileIcons: {
    add: (icon: FileIcon) => void
  }
  // The URL of a file of the plugin's folder, for an `<img>`; `path` is relative to that folder.
  readonly fileUrl: (path: string) => string
  readonly sidebar: {
    // Opens the sidebar on this plugin's `sidebar.panel` contribution of that name.
    showPanel: (name?: string) => void
  }
}

export type UiPlugin = (ctx: UiContext) => void

export const defineUi = (activate: UiPlugin): UiPlugin => activate

export type {
  ActionError,
  ActionFailure,
  CommittedChangeListing,
  ChangeListing,
  DiscardFailure,
  Draft,
  DraftImage,
  FileListing,
  FolderListing,
  SessionLocationLabel,
  UiHost,
}
export * from "./components.ts"

export const Slot = <S extends SlotName>(props: {
  readonly slot: S
  readonly props: SlotProps[S]
  readonly tool?: string
}) => createElement(useHost().components.Slot, props)

export const UiHostProvider = ({ host, children }: { host: UiHost; children?: ReactNode }) =>
  createElement(HostContext.Provider, { value: host }, children)

export const useSession = (sessionId: string) => useHost().useSession(sessionId)
export const useSessions = () => useHost().useSessions()
export const useProjects = () => useHost().useProjects()
export const useSelectedSessionId = () => useHost().useSelectedSessionId()
export const useTabs = () => useHost().useTabs()
export const useTabsLoaded = () => useHost().useTabsLoaded()
export const useOpenTab = () => useHost().useOpenTab()
export const useTranscript = (sessionId: string) => useHost().useTranscript(sessionId)
export const useUsage = (sessionId: string) => useHost().useUsage(sessionId)
export const useAnnotations = <K extends string>(sessionId: string, kind: K) =>
  useHost().useAnnotations(sessionId, kind) as ReadonlyArray<AnnotationOf<K>>
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)
export const useAnswerQuestion = (sessionId: string) => useHost().useAnswerQuestion(sessionId)
export const useSessionActions = (session: Session) => useHost().useSessionActions(session)
export const useRenameSession = (session: Session) => useHost().useRenameSession(session)
export const useSessionLocation = (session: Session) => useHost().useSessionLocation(session)
export const useDraft = (sessionId: string) => useHost().useDraft(sessionId)
export const useSendMessage = (sessionId: string) => useHost().useSendMessage(sessionId)
export const useTakeUnreadMessages = (sessionId: string) =>
  useHost().useTakeUnreadMessages(sessionId)
export const useInterruptSession = (sessionId: string) => useHost().useInterruptSession(sessionId)
export const useSendNow = (sessionId: string) => useHost().useSendNow(sessionId)
export const useOfferedRunOptions = (sessionId: string) => useHost().useOfferedRunOptions(sessionId)
export const useSetRunOptions = (sessionId: string) => useHost().useSetRunOptions(sessionId)
export const useCommandHandler = (commandId: string, run: () => void, enabled?: boolean) =>
  useHost().useCommandHandler(commandId, run, enabled)
export const useKeyHint = (title: string, commandId: string) =>
  useHost().useKeyHint(title, commandId)
export const useListFolder = () => useHost().useListFolder()
export const useOpenFile = () => useHost().useOpenFile()
export const useListFiles = () => useHost().useListFiles()
export const useFolderChanges = (
  sessionId: string,
  onChange: (paths: ReadonlyArray<string>) => void,
) => useHost().useFolderChanges(sessionId, onChange)
export const useGitStatus = (sessionId: string) => useHost().useGitStatus(sessionId)
export const useGitStatusFailure = (sessionId: string) => useHost().useGitStatusFailure(sessionId)
export const useFileOnScreen = (sessionId: string) => useHost().useFileOnScreen(sessionId)
export const useChanges = (sessionId: string) => useHost().useChanges(sessionId)
export const useOpenDiff = () => useHost().useOpenDiff()
export const useDiffOnScreen = (sessionId: string) => useHost().useDiffOnScreen(sessionId)
export const useSettings = () => useHost().useSettings()
export const useCommittedChanges = (sessionId: string) => useHost().useCommittedChanges(sessionId)
export const useOpenCommittedDiff = () => useHost().useOpenCommittedDiff()
export const useCommittedDiffOnScreen = (sessionId: string) =>
  useHost().useCommittedDiffOnScreen(sessionId)
export const useDiscardChanges = () => useHost().useDiscardChanges()
export { formatToolInput } from "./format-tool-input.ts"
export { pendingApproval } from "./pending-approval.ts"
export { pendingQuestion } from "./pending-question.ts"
export { statusLabel } from "./status-label.ts"
