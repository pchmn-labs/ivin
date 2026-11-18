import { createElement } from "react"
import type { ComponentType, ReactNode } from "react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { HostContext, useHost } from "./host-context.ts"
import type { UiHost } from "./host-context.ts"

export type { Session, TranscriptItem }
export type MessageItem = Extract<TranscriptItem, { type: "message" }>
export type ThinkingItem = Extract<TranscriptItem, { type: "thinking" }>
export type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
export type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
export type ErrorItem = Extract<TranscriptItem, { type: "error" }>
export type InterruptionItem = Extract<TranscriptItem, { type: "interruption" }>
export type MessageSlotItem = MessageItem | ThinkingItem | ErrorItem | InterruptionItem

export interface SlotProps {
  "transcript.message": { readonly item: MessageSlotItem; readonly sessionId: string }
  "transcript.toolCall": { readonly item: ToolCallItem; readonly sessionId: string }
  "transcript.approval": { readonly item: ApprovalItem; readonly sessionId: string }
  "composer.status": { readonly sessionId: string }
  "composer.above": {
    readonly session: Session
    readonly isEmptyComposer: (target: EventTarget | null) => boolean
  }
}
export type SlotName = keyof SlotProps

export interface SlotOptions {
  readonly order?: number
  readonly name?: string
  readonly replaces?: string
  readonly tool?: string
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
}

export type UiPlugin = (ctx: UiContext) => void

export const defineUi = (activate: UiPlugin): UiPlugin => activate

export type { UiHost }
export * from "./components.ts"

export const UiHostProvider = ({ host, children }: { host: UiHost; children?: ReactNode }) =>
  createElement(HostContext.Provider, { value: host }, children)

export const useSession = (sessionId: string) => useHost().useSession(sessionId)
export const useSessions = () => useHost().useSessions()
export const useTranscript = (sessionId: string) => useHost().useTranscript(sessionId)
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)
