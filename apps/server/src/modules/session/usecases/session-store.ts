import type { Session } from "@ivin/contracts/session"
import { Context, type Effect } from "effect"

export class SessionStore extends Context.Service<
  SessionStore,
  {
    readonly insert: (session: Session) => Effect.Effect<void>
    readonly findById: (id: string) => Effect.Effect<Session | null>
    readonly listByProject: (projectPath: string) => Effect.Effect<readonly Session[]>
    readonly rename: (id: string, title: string) => Effect.Effect<void>
    // No-op once the title was set by a first message or a rename.
    readonly setTitleIfUnset: (id: string, title: string) => Effect.Effect<void>
    readonly providerSessionId: (id: string) => Effect.Effect<string | null>
    readonly setProviderSessionId: (id: string, providerSessionId: string) => Effect.Effect<void>
    readonly setStatus: (id: string, status: Session["status"]) => Effect.Effect<void>
    readonly touch: (id: string, at: Session["lastActivityAt"]) => Effect.Effect<void>
  }
>()("ivin/server/SessionStore") {}
