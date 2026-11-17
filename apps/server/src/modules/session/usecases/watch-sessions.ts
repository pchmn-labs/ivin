import { Effect, Stream } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { SessionStore } from "./session-store.ts"

export const watchSessions = (projectPath: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const feed = yield* SessionFeed
      const store = yield* SessionStore
      const changes = yield* feed.watch(projectPath)
      const current = yield* store.listByProject(projectPath)
      return Stream.fromIterable(current).pipe(Stream.concat(changes))
    }),
  )
