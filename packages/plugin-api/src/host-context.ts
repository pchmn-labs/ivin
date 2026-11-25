import { createContext, useContext } from "react"
import type {
  AgentCommand,
  Annotation,
  ApprovalItem,
  Change,
  FolderEntry,
  GitStatusEntry,
  HarnessRunOptions,
  ImageData,
  OpenProjects,
  QuestionAnswer,
  QuestionItem,
  RunOptions,
  Session,
  SessionUsage,
  Settings,
  Tab,
  TaskItem,
  ViewParams,
  ViewPlacement,
} from "./types.ts"
import type { ErrorMessageProps, HostComponents, MenuItem } from "./components.ts"

export interface ActionFailure {
  readonly text: string
  readonly retryable: boolean
}

// What a failed action shows in place: its message, with Retry when running it again can help.
export type ActionError = Pick<ErrorMessageProps, "message" | "onRetry">

// `none`: the session's harness takes no agent commands.
export type AgentCommandListing =
  | { readonly kind: "none" }
  | { readonly kind: "loading" }
  | { readonly kind: "listed"; readonly commands: ReadonlyArray<AgentCommand> }
  | { readonly kind: "failed"; readonly failure: ActionFailure }

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

export type ChangeKind = "working" | "committed"

export type ChangeListingOf<K extends ChangeKind> = K extends "committed"
  ? CommittedChangeListing
  : ChangeListing

export interface DiffOnScreen {
  readonly path: string
  readonly kind: ChangeKind
}

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
  // The selected project's tabs and sessions: `loaded` once its tabs first arrive from the server,
  // `failed` while either feed is down, and `retry` restarts the one that failed.
  readonly useSessionListStatus: () => {
    readonly loaded: boolean
    readonly failed: boolean
    readonly retry: () => void
  }
  // Selects the session's project and its tab, opening one if it has none.
  readonly useOpenTab: () => (sessionId: string) => void
  // The approval the session waits on: the last one still unanswered.
  readonly usePendingApproval: (sessionId: string) => ApprovalItem | undefined
  // The questions the session waits on: the last ones still unanswered.
  readonly usePendingQuestion: (sessionId: string) => QuestionItem | undefined
  // Tokens and cost summed over the whole session by the server; null until it has any usage.
  readonly useUsage: (sessionId: string) => SessionUsage
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
  // `failure` is the last rename of the session that failed, until the next one.
  readonly useRenameSession: (session: Session) => {
    readonly rename: (title: string) => void
    readonly failure: ActionError | null
  }
  // Where the session works: its checkout, a worktree, or a folder outside git.
  readonly useSessionLocation: (session: Session) => SessionLocationLabel
  // The unsent message of the session's composer, kept across session switches.
  readonly useDraft: (
    sessionId: string,
  ) => readonly [Draft, (update: (current: Draft) => Draft) => void]
  // Sends the draft's text and the images its markers name; the first message also starts the
  // session in the working folder picked in its status line. A send that fails puts its draft
  // back and sets `failure`, even when the session is not on screen; each send reports its own.
  readonly useSendMessage: (sessionId: string) => {
    readonly send: (draft: Draft) => void
    readonly failure: ActionError | null
  }
  // Puts the messages the agent never read, with their images, in the session's draft once.
  readonly useTakeUnreadMessages: (sessionId: string) => void
  readonly useInterruptSession: (sessionId: string) => () => void
  // Stops the turn so the agent reads the session's pending messages now.
  readonly useSendNow: (sessionId: string) => {
    readonly sendNow: () => void
    readonly failure: ActionError | null
  }
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
  // Archive all and Delete all for these sessions, each asking once; failures show through `useSessionActions`.
  readonly useAllSessionsActions: (sessions: ReadonlyArray<Session>) => {
    readonly items: ReadonlyArray<MenuItem>
  }
  // Lists one level of a folder of the session's working folder; `path` is relative to it, "" for itself.
  readonly useListFolder: () => (sessionId: string, path: string) => Promise<FolderListing>
  // Opens the plugin's view `"<plugin>/<view>"` for the session, or selects an equal one that is
  // open. Where it opens is the user's setting, then `options.placement`, then the manifest's default.
  readonly useOpenView: () => (
    sessionId: string,
    view: string,
    params: ViewParams,
    options?: { readonly placement?: ViewPlacement },
  ) => Promise<ActionFailure | undefined>
  // Opens a file of the session's working folder as the `files/file` view, or selects it if open; `path` as above.
  readonly useOpenFile: () => (
    sessionId: string,
    path: string,
  ) => Promise<ActionFailure | undefined>
  // The skills and commands the session's harness runs from a message starting with `/name`.
  // `refresh` asks the server again and keeps the list shown meanwhile.
  readonly useAgentCommands: (sessionId: string) => {
    readonly listing: AgentCommandListing
    readonly refresh: () => void
  }
  // Every file of the session's working folder that git does not ignore; `paths` as above.
  readonly useListFiles: () => (sessionId: string) => Promise<FileListing>
  // Runs `onChange` with the paths changed on disk while mounted; none when only git's state changed.
  readonly useFolderChanges: (
    sessionId: string,
    onChange: (paths: ReadonlyArray<string>) => void,
  ) => void
  // The changed files of the working folder, kept up to date with the disk. `failure` is why
  // `entries` is empty when git could not read them, else null; `retry` reads them again.
  readonly useGitStatus: (sessionId: string) => {
    readonly entries: ReadonlyArray<GitStatusEntry>
    readonly failure: ActionFailure | null
    readonly retry: () => void
  }
  // The file the session's tab has selected beside its chat as a sub-view, or null.
  readonly useFileOnScreen: (sessionId: string) => string | null
  // `working`: the uncommitted changes; `committed`: what the branch's commits changed since it
  // left origin's default branch. Kept up to date with the disk.
  readonly useChanges: <K extends ChangeKind>(
    sessionId: string,
    kind: K,
  ) => {
    readonly listing: ChangeListingOf<K>
    readonly retry: () => void
  }
  // Opens the diff of a file as the `changes/diff` view, or selects it if open.
  readonly useOpenDiff: () => (
    sessionId: string,
    path: string,
    kind: ChangeKind,
  ) => Promise<ActionFailure | undefined>
  // The diff the session's tab has selected beside its chat as a sub-view, or null.
  readonly useDiffOnScreen: (sessionId: string) => DiffOnScreen | null
  // A background task of the session, running or ended; undefined once the session no longer knows it.
  readonly useTask: (sessionId: string, taskId: string) => TaskItem | undefined
  // A command task's output so far, read again every second while it runs.
  readonly useTaskOutput: (sessionId: string, taskId: string) => string
  // The user's ~/.ivin/settings.json over the defaults, kept up to date with the file.
  readonly useSettings: () => Settings
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
