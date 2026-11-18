import { createContext, useContext } from "react"
import type { OpenProjects } from "@ivin/contracts/project"
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
  // Every open project's sessions, project by project in their order, each newest activity first.
  readonly useSessions: () => ReadonlyArray<Session>
  readonly useProjects: () => OpenProjects
  // The session on screen: the selected project's selected tab.
  readonly useSelectedSessionId: () => string | null
  // The selected project's tabs, in tab bar order.
  readonly useTabs: () => ReadonlyArray<Tab>
  // Selects the session's project and its tab, opening one if it has none.
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
