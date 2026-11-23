import type {
  RelaunchFailure,
  RenamedBy,
  RunOptions,
  Session,
  SessionStatus,
  PendingMessage,
  WaitingFor,
} from "@ivin/contracts/session"
import { Context, type Effect } from "effect"

export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly insert: (session: Session) => Effect.Effect<void>
    readonly findById: (id: string) => Effect.Effect<Session | null>
    // Archived sessions included.
    readonly listByProject: (projectPath: string) => Effect.Effect<readonly Session[]>
    // False, title unchanged, when the agent renames a session the user named.
    readonly rename: (id: string, title: string, by: RenamedBy) => Effect.Effect<boolean>
    // No-op once the title was set by a first message or a rename.
    readonly setTitleIfUnset: (id: string, title: string) => Effect.Effect<void>
    // False, title unchanged, unless the title is still the first message's.
    readonly replaceMessageTitle: (id: string, title: string) => Effect.Effect<boolean>
    readonly providerSessionId: (id: string) => Effect.Effect<string | null>
    readonly setProviderSessionId: (id: string, providerSessionId: string) => Effect.Effect<void>
    readonly setRunOptions: (
      id: string,
      options: RunOptions,
      at: Session["lastActivityAt"],
    ) => Effect.Effect<void>
    // The options last set on any of the project's sessions, at creation or by a change.
    readonly lastRunOptions: (projectPath: string) => Effect.Effect<RunOptions | null>
    // The options of the last run whose first turn ended without an error.
    readonly confirmedRunOptions: (id: string) => Effect.Effect<RunOptions | null>
    readonly setConfirmedRunOptions: (id: string, options: RunOptions) => Effect.Effect<void>
    readonly setRelaunchFailure: (
      id: string,
      failure: RelaunchFailure | null,
    ) => Effect.Effect<void>
    readonly addPendingMessage: (id: string, message: PendingMessage) => Effect.Effect<void>
    // Null when the message is not pending, such as one that started a turn.
    readonly takePendingMessage: (
      id: string,
      messageId: string,
    ) => Effect.Effect<PendingMessage | null>
    readonly pendingMessages: (id: string) => Effect.Effect<readonly PendingMessage[]>
    readonly markPendingUnread: (id: string) => Effect.Effect<void>
    readonly clearUnreadMessages: (id: string) => Effect.Effect<void>
    readonly setWorkingFolder: (
      id: string,
      workingFolder: string,
      branch: string | null,
    ) => Effect.Effect<void>
    // Cleared by the next `setWorkingFolder`.
    readonly markWorkingFolderDeleted: (id: string) => Effect.Effect<void>
    // Keeps `statusChangedAt` when the status is already `status`.
    readonly setStatus: (
      id: string,
      status: SessionStatus,
      at: Session["statusChangedAt"],
      waitingFor?: WaitingFor,
    ) => Effect.Effect<void>
    // No run survives a connection, so a session left working or waiting is idle again, its pending messages unread.
    readonly resetRunning: Effect.Effect<void>
    readonly touch: (id: string, at: Session["lastActivityAt"]) => Effect.Effect<void>
    readonly setArchivedAt: (id: string, at: Session["archivedAt"]) => Effect.Effect<void>
    // Erases the session, its transcript and its tab in one transaction.
    readonly delete: (id: string) => Effect.Effect<void>
  }
>()("ivin/server/SessionStore") {}
