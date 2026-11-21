import { createContext, useContext } from "react"
import type { Annotation } from "@ivin/contracts/annotation"
import type { FolderEntry } from "@ivin/contracts/file"
import type { OpenProjects } from "@ivin/contracts/project"
import type { Session } from "@ivin/contracts/session"
import type { Tab } from "@ivin/contracts/tab"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import type { HostComponents, MenuItem } from "./components.ts"

export interface ActionFailure {
  readonly text: string
  readonly retryable: boolean
}

// `deleted`: the session's working folder no longer exists.
export type FolderListing =
  | { readonly kind: "listed"; readonly entries: ReadonlyArray<FolderEntry> }
  | { readonly kind: "deleted" }
  | { readonly kind: "failed"; readonly failure: ActionFailure }

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
  // The session's annotations of this kind, oldest first.
  readonly useAnnotations: (sessionId: string, kind: string) => ReadonlyArray<Annotation>
  readonly useAnswerApproval: (
    sessionId: string,
  ) => (answer: {
    readonly requestId: string
    readonly allow: boolean
  }) => Promise<ActionFailure | undefined>
  // Archive and Delete for the session's menu, and the last of them that failed.
  readonly useSessionActions: (session: Session) => {
    readonly items: ReadonlyArray<MenuItem>
    readonly failure: string | null
  }
  // Lists one level of a folder of the session's working folder; `path` is relative to it, "" for itself.
  readonly useListFolder: () => (sessionId: string, path: string) => Promise<FolderListing>
  readonly components: HostComponents
}

export const HostContext = createContext<UiHost | null>(null)

export const useHost = (): UiHost => {
  const host = useContext(HostContext)
  if (host === null) throw new Error("A plugin hook ran outside of a UiHostProvider")
  return host
}
