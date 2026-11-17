import { createContext, createElement, useContext } from "react"
import type { ComponentType, ReactNode } from "react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"

export type { Session, TranscriptItem }
export type MessageItem = Extract<TranscriptItem, { type: "message" }>
export type ThinkingItem = Extract<TranscriptItem, { type: "thinking" }>
export type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
export type ApprovalItem = Extract<TranscriptItem, { type: "approval" }>
export type ErrorItem = Extract<TranscriptItem, { type: "error" }>
export type MessageSlotItem = MessageItem | ThinkingItem | ErrorItem

export interface SlotProps {
  "transcript.message": { readonly item: MessageSlotItem; readonly sessionId: string }
  "transcript.toolCall": { readonly item: ToolCallItem; readonly sessionId: string }
  "transcript.approval": { readonly item: ApprovalItem; readonly sessionId: string }
  "composer.status": { readonly sessionId: string }
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

export interface UiHost {
  readonly useSession: (sessionId: string) => Session | undefined
  readonly useSessions: () => ReadonlyArray<Session>
  readonly useTranscript: (sessionId: string) => ReadonlyArray<TranscriptItem>
  readonly useAnswerApproval: (
    sessionId: string,
  ) => (answer: { readonly requestId: string; readonly allow: boolean }) => Promise<void>
  readonly Markdown: ComponentType<{ text: string }>
}

const HostContext = createContext<UiHost | null>(null)

export const UiHostProvider = ({ host, children }: { host: UiHost; children?: ReactNode }) =>
  createElement(HostContext.Provider, { value: host }, children)

const useHost = (): UiHost => {
  const host = useContext(HostContext)
  if (host === null) throw new Error("A plugin hook ran outside of a UiHostProvider")
  return host
}

export const useSession = (sessionId: string) => useHost().useSession(sessionId)
export const useSessions = () => useHost().useSessions()
export const useTranscript = (sessionId: string) => useHost().useTranscript(sessionId)
export const useAnswerApproval = (sessionId: string) => useHost().useAnswerApproval(sessionId)

export const Markdown = ({ text }: { text: string }) => {
  const HostMarkdown = useHost().Markdown
  return createElement(HostMarkdown, { text })
}
