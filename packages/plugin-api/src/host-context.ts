import { createContext, useContext } from "react"
import type { Annotation } from "@ivin/contracts/annotation"
import type { Change, FolderEntry, GitStatusEntry } from "@ivin/contracts/file"
import type { OpenProjects } from "@ivin/contracts/project"
import type { HarnessRunOptions, RunOptions, Session } from "@ivin/contracts/session"
import type { Settings } from "@ivin/contracts/setting"
import type { Tab } from "@ivin/contracts/tab"
import type { ImageData, QuestionAnswer, TranscriptItem } from "@ivin/contracts/transcript"
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

// `deleted`: the session's working folder no longer exists.
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

// `base`: the branch compared with, `origin/<default branch>`; the changes are its commits' since.
export type CommittedChangeListing =
  | Exclude<ChangeListing, { kind: "listed" }>
  | {
      readonly kind: "listed"
      readonly base: string
      readonly changes: ReadonlyArray<Change>
    }
  | { readonly kind: "no_origin" }
  | { readonly kind: "no_default_branch" }
  | { readonly kind: "no_merge_base" }

export interface DiscardFailure extends ActionFailure {
  readonly gitMessage: string | null
}

export interface DraftImage extends ImageData {
  readonly name: string
}

// `images` keeps every image pasted since the last send, so undoing a deleted marker brings its image back.
export interface Draft {
  readonly text: string
  readonly images: ReadonlyArray<DraftImage>
}

export interface SessionLocationLabel {
  readonly kind: "checkout" | "worktree" | "folder"
  readonly label: string
  // Null when there is none yet, or outside a git repository.
  readonly branch: string | null
  readonly deleted?: true
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
  // False until the selected project's tabs first arrive from the server.
  readonly useTabsLoaded: () => boolean
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
  readonly useAnswerQuestion: (
    sessionId: string,
  ) => (answer: {
    readonly requestId: string
    readonly answers: ReadonlyArray<QuestionAnswer> | null
  }) => Promise<ActionFailure | undefined>
  readonly useRenameSession: () => (session: Session, title: string) => void
  // Where the session works: its checkout, a worktree, or a folder outside git.
  readonly useSessionLocation: (session: Session) => SessionLocationLabel
  // The unsent message of the session's composer, kept across session switches.
  readonly useDraft: (
    sessionId: string,
  ) => readonly [Draft, (update: (current: Draft) => Draft) => void]
  // Sends the draft's text and the images its markers name; the first message also starts the
  // session in the working folder picked in its status line.
  readonly useSendMessage: (
    sessionId: string,
  ) => (draft: Draft) => Promise<ActionFailure | undefined>
  readonly useInterruptSession: (sessionId: string) => () => void
  // Stops the turn so the agent reads the session's pending messages now.
  readonly useSendNow: (sessionId: string) => () => void
  // The models, efforts and permission modes the session's harness offers; null until the server
  // answers, or when the session runs on another harness than the server's.
  readonly useOfferedRunOptions: (sessionId: string) => HarnessRunOptions | null
  readonly useSetRunOptions: (
    sessionId: string,
  ) => (options: Partial<RunOptions>) => Promise<ActionFailure | undefined>
  // Runs `run` for the command while mounted and `enabled`, in place of its other handlers.
  readonly useCommandHandler: (commandId: string, run: () => void, enabled?: boolean) => void
  // `title` followed by the command's key, as a tooltip shows it: "Send (↵)".
  readonly useKeyHint: (title: string, commandId: string) => string
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
  // The user's ~/.ivin/settings.json over the defaults, kept up to date with the file.
  readonly useSettings: () => Settings
  // What the commits of the session's branch changed since it left origin's default branch,
  // kept up to date with the disk.
  readonly useCommittedChanges: (sessionId: string) => {
    readonly listing: CommittedChangeListing
    readonly retry: () => void
  }
  // Opens what the branch's commits changed in a file beside the session's chat, or selects it.
  readonly useOpenCommittedDiff: () => (
    sessionId: string,
    path: string,
  ) => Promise<ActionFailure | undefined>
  readonly useCommittedDiffOnScreen: (sessionId: string) => string | null
  // Restores each file to its last commit, or deletes it when git does not track it or it is new.
  readonly useDiscardChanges: () => (
    sessionId: string,
    paths: ReadonlyArray<string>,
  ) => Promise<DiscardFailure | undefined>
  readonly components: HostComponents
}

export const HostContext = createContext<UiHost | null>(null)

export const useHost = (): UiHost => {
  const host = useContext(HostContext)
  if (host === null) throw new Error("A plugin hook ran outside of a UiHostProvider")
  return host
}
