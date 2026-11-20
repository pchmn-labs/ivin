import type { SessionChange } from "@ivin/contracts/session"
import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"
import { SessionStore } from "./session-store.ts"

const FEED_CAPACITY = 256

const projectOf = (change: SessionChange) =>
  change._tag === "changed" ? change.session.projectPath : change.projectPath

export class SessionFeed extends Context.Service<
  SessionFeed,
  {
    // Publishes the stored state of the session, an archived session as removed.
    readonly publish: (sessionId: string) => Effect.Effect<void>
    readonly publishRemoved: (projectPath: string, sessionId: string) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed.
    readonly watch: (
      projectPath: string,
    ) => Effect.Effect<Stream.Stream<SessionChange>, never, Scope.Scope>
  }
>()("ivin/server/SessionFeed") {}

export const layerSessionFeed = Layer.effect(SessionFeed)(
  Effect.gen(function* () {
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<SessionChange>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    const store = yield* SessionStore
    const publishRemoved = (projectPath: string, sessionId: string) =>
      PubSub.publish(pubsub, { _tag: "removed", projectPath, sessionId } as const).pipe(
        Effect.asVoid,
      )
    return {
      publish: (sessionId) =>
        store.findById(sessionId).pipe(
          Effect.flatMap((session) => {
            if (!session) return Effect.void
            if (session.archivedAt !== null) return publishRemoved(session.projectPath, session.id)
            return PubSub.publish(pubsub, { _tag: "changed", session } as const)
          }),
        ),
      publishRemoved,
      watch: (projectPath) =>
        PubSub.subscribe(pubsub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((change) => projectOf(change) === projectPath),
            ),
          ),
        ),
    }
  }),
)
