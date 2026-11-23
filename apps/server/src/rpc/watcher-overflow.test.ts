import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { AnnotationTarget } from "@ivin/contracts/annotation"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, Stream } from "effect"
import { expect, test } from "vitest"
import { AnnotationFeed } from "../modules/annotation/usecases/annotation-feed.ts"
import { watchAnnotations } from "../modules/annotation/usecases/watch-annotations.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { SessionFeed } from "../modules/session/usecases/session-feed.ts"
import { watchSessions } from "../modules/session/usecases/watch-sessions.ts"
import { ItemFeed } from "../modules/transcript/usecases/item-feed.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { watchItems } from "../modules/transcript/usecases/watch-items.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

const OVERFLOW = 5000

const pullUntil = <A>(
  pull: Effect.Effect<readonly A[], unknown>,
  done: (received: readonly A[]) => boolean,
) =>
  Effect.gen(function* () {
    const received: A[] = []
    while (!done(received)) received.push(...(yield* pull))
    return received
  })

const withServices = <A>(use: (db: DatabaseSync) => Effect.Effect<A, unknown, unknown>) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  db.prepare(
    `INSERT INTO sessions (id, project_path, working_folder, title, harness, model, effort,
       permission_mode, run_options_at, status, status_changed_at, created_at, last_activity_at)
     VALUES ('s1', '/p', '/p', 't', 'scripted', 'm', 'e', 'p', 1, 'idle', 1, 1, 1)`,
  ).run()
  return Effect.runPromise(
    Effect.suspend(() => use(db)).pipe(
      Effect.provide(
        layerServices.pipe(
          Layer.provideMerge(Layer.succeed(Database)(db)),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provideMerge(layerScripted([])),
        ),
      ),
      Effect.scoped,
    ) as Effect.Effect<A>,
  )
}

test("a transcript watcher that fell behind gets the last page again", async () => {
  const next = await withServices(() =>
    Effect.gen(function* () {
      const pull = yield* Stream.toPull(watchItems("s1", 10))
      expect((yield* pull)[0]).toMatchObject({ type: "page" })
      const feed = yield* ItemFeed
      for (let position = 0; position < OVERFLOW; position++)
        yield* feed.publish({
          type: "delta",
          sessionId: "s1",
          itemId: "i",
          position,
          kind: "message",
          text: "x",
        })
      return (yield* pull)[0]
    }),
  )

  expect(next).toMatchObject({ type: "page" })
})

test("changes for other sessions do not push out a transcript watcher's own", async () => {
  const next = await withServices(() =>
    Effect.gen(function* () {
      const pull = yield* Stream.toPull(watchItems("s1", 10))
      yield* pull
      const feed = yield* ItemFeed
      for (let position = 0; position < OVERFLOW; position++)
        yield* feed.publish({
          type: "delta",
          sessionId: "other",
          itemId: "i",
          position,
          kind: "message",
          text: "x",
        })
      yield* feed.publish({
        type: "delta",
        sessionId: "s1",
        itemId: "mine",
        position: 1,
        kind: "message",
        text: "x",
      })
      return (yield* pull)[0]
    }),
  )

  expect(next).toMatchObject({ type: "delta", itemId: "mine" })
})

test("a session watcher that fell behind gets the project's sessions again", async () => {
  const next = await withServices(() =>
    Effect.gen(function* () {
      const pull = yield* Stream.toPull(watchSessions("/p"))
      yield* pull
      const feed = yield* SessionFeed
      for (let i = 0; i < OVERFLOW; i++) yield* feed.publishRemoved("/p", `gone-${i}`)
      return yield* pullUntil(pull, (received) => received.some((c) => c._tag === "changed"))
    }),
  )

  expect(next[0]).toMatchObject({ _tag: "removed", sessionId: "gone-0" })
  expect(next.at(-1)).toMatchObject({ _tag: "changed", session: { id: "s1" } })
})

test("an annotation watcher that fell behind gets the removals it missed, then the current annotations", async () => {
  const target: AnnotationTarget = { _tag: "session", sessionId: "s1" }
  const received = await withServices((db) =>
    Effect.gen(function* () {
      db.prepare(
        `INSERT INTO annotations (id, target_type, target_id, ns, kind, data, created_at, updated_at)
         VALUES ('kept', 'session', 's1', 'ivin', 'note', '{}', 1, 1)`,
      ).run()
      const pull = yield* Stream.toPull(watchAnnotations(target))
      yield* pull
      const feed = yield* AnnotationFeed
      for (let i = 0; i < OVERFLOW; i++)
        yield* feed.publish({ _tag: "removed", id: `gone-${i}`, target })
      return yield* pullUntil(pull, (got) => got.some((c) => c._tag === "changed"))
    }),
  )

  expect(received[0]).toMatchObject({ _tag: "removed", id: "gone-0" })
  expect(received.at(-1)).toMatchObject({ _tag: "changed", annotation: { id: "kept" } })
})
