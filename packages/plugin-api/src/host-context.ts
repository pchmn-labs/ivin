import { createContext, useContext } from "react"
import type { Session } from "@ivin/contracts/session"
import type { Tab } from "@ivin/contracts/tab"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import type { HostComponents } from "./components.ts"

export interface ActionFailure {
  readonly text: string
  readonly retryable: boolean
}

export interface UiHost {
  readonly useSession: (sessionId: string) => Session | undefined
  // The selected project's sessions, newest activity first.
  readonly useSessions: () => ReadonlyArray<Session>
  // The selected project's tabs, in tab bar order.
  readonly useTabs: () => ReadonlyArray<Tab>
  // Selects the session's tab, opening one if it has none.
  readonly useOpenTab: () => (sessionId: string) => void
  readonly useTranscript: (sessionId: string) => ReadonlyArray<TranscriptItem>
  readonly useAnswerApproval: (
    sessionId: string,
  ) => (answer: {
    readonly requestId: string
    readonly allow: boolean
  }) => Promise<ActionFailure | undefined>
  readonly components: HostComponents
}

export const HostContext = createContext<UiHost | null>(null)

export const useHost = (): UiHost => {
  const host = useContext(HostContext)
  if (host === null) throw new Error("A plugin hook ran outside of a UiHostProvider")
  return host
}
