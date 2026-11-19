import { createElement } from "react"
import type { ComponentType, ReactNode } from "react"
import type { OpenProjects, Project } from "@ivin/contracts/project"
import type { Session } from "@ivin/contracts/session"
import type { Tab } from "@ivin/contracts/tab"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { HostContext, useHost } from "./host-context.ts"
import type { ActionFailure, UiHost } from "./host-context.ts"

export type { OpenProjects, Project, Session, Tab, TranscriptItem }
export type MessageItem = Extract<TranscriptItem, { type: "message" }>
export type ThinkingItem = Extract<TranscriptItem, { type: "thinking" }>
export type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
export type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
export type ErrorItem = Extract<TranscriptItem, { type: "error" }>
export type InterruptionItem = Extract<TranscriptItem, { type: "interruption" }>
export type WorkingFolderItem = Extract<TranscriptItem, { type: "working_folder" }>
export type MessageSlotItem =
  | MessageItem
  | ThinkingItem
  | ErrorItem
  | InterruptionItem
  | WorkingFolderItem

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
}
export type SlotName = keyof SlotProps

export interface SlotOptions {
  readonly order?: number
  readonly name?: string
  readonly replaces?: string
  readonly tool?: string
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
}

export type UiPlugin = (ctx: UiContext) => void

export const defineUi = (activate: UiPlugin): UiPlugin => activate

export type { ActionFailure, UiHost }
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
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)
export { formatToolInput } from "./format-tool-input.ts"
