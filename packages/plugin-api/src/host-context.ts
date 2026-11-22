import { createContext, useContext } from "react"
import type { Annotation } from "@ivin/contracts/annotation"
import type { Change, FolderEntry, GitStatusEntry } from "@ivin/contracts/file"
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

export type FileListing =
  | {
      readonly kind: "listed"
      readonly paths: ReadonlyArray<string>
      readonly truncated: boolean
    }
  | { readonly kind: "deleted" }
  | { readonly kind: "failed"; readonly failure: ActionFailure }

// `deleted`: the session's working folder no longer exists. `gitMessage` is git's own output.
export type ChangeListing =
  | { readonly kind: "loading" }
  | { readonly kind: "listed"; readonly changes: ReadonlyArray<Change> }
  | { readonly kind: "not_repository" }
  | { readonly kind: "deleted" }
  | {
      readonly kind: "failed"
      readonly failure: ActionFailure
      readonly gitMessage: string | null
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
  // Opens a file of the session's working folder beside its chat, or selects it if open; `path` as above.
  readonly useOpenFile: () => (
    sessionId: string,
    path: string,
  ) => Promise<ActionFailure | undefined>
  // Every file of the session's working folder that git does not ignore; `paths` as above.
  readonly useListFiles: () => (sessionId: string) => Promise<FileListing>
  // Runs `onChange` with the paths changed on disk while mounted; none when only git's state changed.
  readonly useFolderChanges: (
    sessionId: string,
    onChange: (paths: ReadonlyArray<string>) => void,
  ) => void
  // The changed files of the working folder, kept up to date with the disk.
  readonly useGitStatus: (sessionId: string) => ReadonlyArray<GitStatusEntry>
  // The file the session's tab has selected beside its chat, or null.
  readonly useFileOnScreen: (sessionId: string) => string | null
  // The working folder's uncommitted changes, kept up to date with the disk.
  readonly useChanges: (sessionId: string) => {
    readonly listing: ChangeListing
    readonly retry: () => void
  }
  // Opens the uncommitted diff of a file beside the session's chat, or selects it if open.
  readonly useOpenDiff: () => (
    sessionId: string,
    path: string,
  ) => Promise<ActionFailure | undefined>
  // The file whose diff the session's tab has selected beside its chat, or null.
  readonly useDiffOnScreen: (sessionId: string) => string | null
  readonly components: HostComponents
}

export const HostContext = createContext<UiHost | null>(null)

export const useHost = (): UiHost => {
  const host = useContext(HostContext)
  if (host === null) throw new Error("A plugin hook ran outside of a UiHostProvider")
  return host
}
