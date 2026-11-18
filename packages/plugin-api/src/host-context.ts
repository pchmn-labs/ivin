import { createContext, useContext } from "react"
import type { Session } from "@ivin/contracts/session"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import type { HostComponents } from "./components.ts"

export interface ActionFailure {
  readonly text: string
  readonly retryable: boolean
}

export interface UiHost {
  readonly useSession: (sessionId: string) => Session | undefined
  readonly useSessions: () => ReadonlyArray<Session>
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
