import { createElement } from "react"
import type { ComponentType, ReactNode } from "react"
import type {
  Annotation,
  AnnotationDataOf,
  AnnotationTarget,
  IssueAnnotationData,
  PrAnnotationData,
} from "@ivin/contracts/annotation"
import type { FolderEntry } from "@ivin/contracts/file"
import type { OpenProjects, Project } from "@ivin/contracts/project"
import type { Session } from "@ivin/contracts/session"
import type { Tab } from "@ivin/contracts/tab"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { HostContext, useHost } from "./host-context.ts"
import type { ActionFailure, FolderListing, UiHost } from "./host-context.ts"

export type {
  Annotation,
  AnnotationTarget,
  FolderEntry,
  IssueAnnotationData,
  OpenProjects,
  PrAnnotationData,
  Project,
  Session,
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
}
export type SlotName = keyof SlotProps

export interface SlotOptions {
  readonly order?: number
  readonly name?: string
  readonly replaces?: string
  readonly tool?: string
  // The tab's name, for a `sidebar.panel` contribution.
  readonly title?: string
}

export interface CommandOptions {
  readonly title: string
  readonly run: () => void
}

export interface KeybindingOptions {
  // `mod` is ⌘ on macOS and Ctrl elsewhere: "mod+shift+p", "escape".
  readonly key: string
  readonly command: string
  // An area of the window, such as "composer"; everywhere when absent.
  readonly when?: string
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
  // A default keybinding, which the user's ~/.ivin/keybindings.json can change.
  readonly keybindings: {
    add: (keybinding: KeybindingOptions) => void
  }
  readonly sidebar: {
    // Opens the sidebar on this plugin's `sidebar.panel` contribution of that name.
    showPanel: (name?: string) => void
  }
}

export type UiPlugin = (ctx: UiContext) => void

export const defineUi = (activate: UiPlugin): UiPlugin => activate

export type { ActionFailure, FolderListing, UiHost }
export * from "./components.ts"

export const UiHostProvider = ({ host, children }: { host: UiHost; children?: ReactNode }) =>
  createElement(HostContext.Provider, { value: host }, children)

export const useSession = (sessionId: string) => useHost().useSession(sessionId)
export const useSessions = () => useHost().useSessions()
export const useProjects = () => useHost().useProjects()
export const useSelectedSessionId = () => useHost().useSelectedSessionId()
export const useTabs = () => useHost().useTabs()
export const useOpenTab = () => useHost().useOpenTab()
export const useTranscript = (sessionId: string) => useHost().useTranscript(sessionId)
export const useAnnotations = <K extends string>(sessionId: string, kind: K) =>
  useHost().useAnnotations(sessionId, kind) as ReadonlyArray<AnnotationOf<K>>
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)
export const useSessionActions = (session: Session) => useHost().useSessionActions(session)
export const useListFolder = () => useHost().useListFolder()
export { formatToolInput } from "./format-tool-input.ts"
export { pendingApproval } from "./pending-approval.ts"
