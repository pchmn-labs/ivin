import type { Session } from "@ivin/contracts/session"
import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"
import { SessionStore } from "./session-store.ts"

const FEED_CAPACITY = 256

export class SessionFeed extends Context.Service<
  SessionFeed,
  {
    // Publishes the stored state of the session.
    readonly publish: (sessionId: string) => Effect.Effect<void>
    // Subscribed on return: nothing published afterwards is missed.
    readonly watch: (
      projectPath: string,
    ) => Effect.Effect<Stream.Stream<Session>, never, Scope.Scope>
  }
>()("ivin/server/SessionFeed") {}

export const layerSessionFeed = Layer.effect(SessionFeed)(
  Effect.gen(function* () {
    const pubsub = yield* Effect.acquireRelease(
      PubSub.sliding<Session>(FEED_CAPACITY),
      PubSub.shutdown,
    )
    const store = yield* SessionStore
    return {
      publish: (sessionId) =>
        store
          .findById(sessionId)
          .pipe(
            Effect.flatMap((session) => (session ? PubSub.publish(pubsub, session) : Effect.void)),
          ),
      watch: (projectPath) =>
        PubSub.subscribe(pubsub).pipe(
          Effect.map((subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter((session) => session.projectPath === projectPath),
            ),
          ),
        ),
    }
  }),
)
