import { createElement } from "react"
import type { ComponentType, ReactNode } from "react"
import type { Extension as EditorExtension } from "@codemirror/state"
import type {
  Annotation,
  AnnotationDataOf,
  AnnotationTarget,
  ApprovalItem,
  Change,
  ChangeStatus,
  CitationAnnotationData,
  ErrorItem,
  FolderEntry,
  GitFileStatus,
  GitStatusEntry,
  HarnessRunOptions,
  ImageData,
  ImageRef,
  InterruptionItem,
  IssueAnnotationData,
  Json,
  MessageItem,
  OfferedModel,
  OfferedValue,
  OpenProjects,
  PendingMessage,
  PrAnnotationData,
  Project,
  Question,
  QuestionAnswer,
  QuestionItem,
  RunOption,
  RunOptionItem,
  TaskStopItem,
  RunOptions,
  Session,
  SessionStatus,
  SessionUsage,
  Settings,
  Tab,
  ThinkingItem,
  ToolCallItem,
  TranscriptItem,
  UtcDateTime,
  ViewParams,
  ViewPlacement,
  ViewProps,
  WorkingFolderItem,
} from "./types.ts"
import { HostContext, useHost } from "./host-context.ts"
import type {
  ActionError,
  ActionFailure,
  ChangeKind,
  ChangeListing,
  ChangeListingOf,
  CommittedChangeListing,
  DiffOnScreen,
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
  AnnotationDataOf,
  AnnotationTarget,
  ApprovalItem,
  Change,
  ChangeStatus,
  CitationAnnotationData,
  ErrorItem,
  FolderEntry,
  GitFileStatus,
  GitStatusEntry,
  HarnessRunOptions,
  ImageData,
  ImageRef,
  InterruptionItem,
  IssueAnnotationData,
  Json,
  MessageItem,
  OfferedModel,
  OfferedValue,
  OpenProjects,
  PendingMessage,
  PrAnnotationData,
  Project,
  Question,
  QuestionAnswer,
  QuestionItem,
  RunOption,
  RunOptionItem,
  TaskStopItem,
  RunOptions,
  Session,
  SessionStatus,
  SessionUsage,
  Settings,
  Tab,
  ThinkingItem,
  ToolCallItem,
  TranscriptItem,
  UtcDateTime,
  ViewParams,
  ViewPlacement,
  ViewProps,
  WorkingFolderItem,
  EditorExtension,
}
export type AnnotationOf<K extends string> = Omit<Annotation, "data"> & {
  readonly data: AnnotationDataOf<K>
}
export type MessageSlotItem =
  | MessageItem
  | ThinkingItem
  | ErrorItem
  | InterruptionItem
  | WorkingFolderItem
  | RunOptionItem
  | TaskStopItem

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
  // The plugin's section of the settings page, in place of the one generated from its manifest.
  "settings.section": Record<string, never>
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

export interface ViewOptions {
  readonly component: ComponentType<ViewProps>
  // The view's tab; the manifest's title when absent.
  readonly title?: (params: ViewParams) => string
  // The view's tab icon; the manifest's icon when absent.
  readonly icon?: (params: ViewParams) => ReactNode
}

export interface OpenViewOptions {
  // Where to open when the user's setting for the view does not decide; one of the view's placements.
  readonly placement?: ViewPlacement
}

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
  // A temporary notification in the session's chat, for what has no place of its own on screen.
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
  readonly views: {
    // The component of a view the manifest declares under `ivin.views`; refused for any other name.
    register: (name: string, view: ViewOptions) => void
    // Opens a view of any plugin for the session, `view` as `"<plugin>/<view>"`.
    open: (
      sessionId: string,
      view: string,
      params: ViewParams,
      options?: OpenViewOptions,
    ) => Promise<ActionFailure | undefined>
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
  ChangeKind,
  ChangeListing,
  ChangeListingOf,
  CommittedChangeListing,
  DiffOnScreen,
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
export const useSessionListStatus = () => useHost().useSessionListStatus()
export const useOpenTab = () => useHost().useOpenTab()
export const usePendingApproval = (sessionId: string) => useHost().usePendingApproval(sessionId)
export const usePendingQuestion = (sessionId: string) => useHost().usePendingQuestion(sessionId)
export const useUsage = (sessionId: string) => useHost().useUsage(sessionId)
export const useAnnotations = <K extends string>(sessionId: string, kind: K) =>
  useHost().useAnnotations(sessionId, kind) as ReadonlyArray<AnnotationOf<K>>
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)
export const useAnswerQuestion = (sessionId: string) => useHost().useAnswerQuestion(sessionId)
export const useSessionActions = (session: Session) => useHost().useSessionActions(session)
export const useAllSessionsActions = (sessions: ReadonlyArray<Session>) =>
  useHost().useAllSessionsActions(sessions)
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
export const useOpenView = () => useHost().useOpenView()
export const useOpenFile = () => useHost().useOpenFile()
export const useListFiles = () => useHost().useListFiles()
export const useFolderChanges = (
  sessionId: string,
  onChange: (paths: ReadonlyArray<string>) => void,
) => useHost().useFolderChanges(sessionId, onChange)
export const useGitStatus = (sessionId: string) => useHost().useGitStatus(sessionId)
export const useFileOnScreen = (sessionId: string) => useHost().useFileOnScreen(sessionId)
export const useChanges = <K extends ChangeKind>(sessionId: string, kind: K) =>
  useHost().useChanges(sessionId, kind)
export const useOpenDiff = () => useHost().useOpenDiff()
export const useDiffOnScreen = (sessionId: string) => useHost().useDiffOnScreen(sessionId)
export const useSettings = () => useHost().useSettings()
export const useDiscardChanges = () => useHost().useDiscardChanges()
export { formatToolInput } from "./format-tool-input.ts"
export { statusLabel } from "./status-label.ts"
