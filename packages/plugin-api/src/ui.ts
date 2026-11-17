import { createContext, createElement, useContext } from "react"
import type { ComponentType, ReactNode } from "react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"

export type { Session, TranscriptItem }
export type MessageItem = Extract<TranscriptItem, { type: "message" }>
export type ThinkingItem = Extract<TranscriptItem, { type: "thinking" }>
export type ToolCallItem = Extract<TranscriptItem, { type: "tool_call" }>
export type UsageItem = Extract<TranscriptItem, { type: "usage" }>

export const API_VERSION = 0

// Thinking has no slot of its own: it goes through `transcript.message`.
export type MessageSlotItem = MessageItem | ThinkingItem

export interface SlotProps {
  "transcript.message": { readonly item: MessageSlotItem; readonly sessionId: string }
  "transcript.toolCall": { readonly item: ToolCallItem; readonly sessionId: string }
  "composer.status": { readonly sessionId: string }
}
export type SlotName = keyof SlotProps

export interface SlotOptions {
  // Contributions render by ascending order; ties keep registration order.
  readonly order?: number
  // Its id is `<pluginId>/<name>`; defaults to the slot name.
  readonly name?: string
  // Id (`<pluginId>/<name>`) of the contribution to take over in the same slot.
  readonly replaces?: string
  // `transcript.toolCall` only: the tool name it renders; absent = every tool.
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

// What the hooks read from the host, which owns the state behind them.
export interface UiHost {
  readonly useSession: (sessionId: string) => Session | undefined
  readonly useSessions: () => ReadonlyArray<Session>
  readonly useTranscript: (sessionId: string) => ReadonlyArray<TranscriptItem>
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
