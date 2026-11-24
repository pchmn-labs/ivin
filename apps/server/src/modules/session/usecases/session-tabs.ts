import { Context, type Effect } from "effect"

export class SessionTabs extends Context.Service<
  SessionTabs,
  {
    // Selects the next tab when the session's was selected; no-op when the session has none.
    readonly remove: (sessionId: string) => Effect.Effect<void>
    readonly openSessionIds: (projectPath: string) => Effect.Effect<readonly string[]>
  }
>()("ivin/server/SessionTabs") {}
