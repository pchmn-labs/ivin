import type { SessionChange } from "@ivin/contracts/session"
import { Context, Effect, Layer, type Scope, type Stream } from "effect"
import { makeWatcherFeed } from "../../../shared/usecases/watcher-feed.ts"
import { SessionStore } from "./session-store.ts"

const WATCHER_BUFFER = 256

const projectOf = (change: SessionChange) =>
  change._tag === "changed" ? change.session.projectPath : change.projectPath

export class SessionFeed extends Context.Service<
  SessionFeed,
  {
    // Publishes the stored state of the session, an archived session as removed.
    readonly publish: (sessionId: string) => Effect.Effect<void>
    readonly publishRemoved: (projectPath: string, sessionId: string) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed. A watcher that falls
    // behind gets the removals it missed, then `current` again.
    readonly watch: (
      projectPath: string,
      current: Effect.Effect<readonly SessionChange[]>,
    ) => Effect.Effect<Stream.Stream<SessionChange>, never, Scope.Scope>
  }
>()("ivin/server/SessionFeed") {}

export const layerSessionFeed = Layer.effect(SessionFeed)(
  Effect.gen(function* () {
    const store = yield* SessionStore
    const feed = makeWatcherFeed<string, SessionChange>({
      capacity: WATCHER_BUFFER,
      matches: (projectPath, change) => projectOf(change) === projectPath,
      isRemoval: (change) => change._tag === "removed",
    })
    const publishRemoved = (projectPath: string, sessionId: string) =>
      feed.publish({ _tag: "removed", projectPath, sessionId })
    return {
      publish: (sessionId) =>
        store.findById(sessionId).pipe(
          Effect.flatMap((session) => {
            if (!session) return Effect.void
            if (session.archivedAt !== null) return publishRemoved(session.projectPath, session.id)
            return feed.publish({ _tag: "changed", session })
          }),
        ),
      publishRemoved,
      watch: feed.watch,
    }
  }),
)
