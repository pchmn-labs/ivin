import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Deferred, Effect, Fiber, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import { mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { expect, test, vi } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import {
  layerHarnessAfterLoginShellPath,
  LoginShellPath,
} from "../shared/usecases/login-shell-path.ts"
import { handlers, layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

// Real git: about 300 ms alone.
vi.setConfig({ testTimeout: 3000 })

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  db: DatabaseSync,
  loginShellPath: Layer.Layer<never>,
  use: (client: Client) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(
            layerHarnessAfterLoginShellPath(
              layerScripted([[{ type: "status", status: "idle", raw: null }]]),
            ),
          ),
          Layer.provide(loginShellPath),
        ),
      ),
      Effect.scoped,
    ),
  )

test("only git commands and agent starts wait for the login shell's PATH", async () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  const project = realpathSync(mkdtempSync(join(tmpdir(), "ivin-login-shell-")))
  execFileSync("git", ["init", "--quiet", "-b", "main"], { cwd: project })

  const session = await withServer(db, Layer.empty, (client) =>
    client["session.create"]({ projectPath: project }),
  )

  let asked = 0
  const gate = Effect.runSync(Deferred.make<void>())
  const pathRead = Layer.succeed(LoginShellPath)({
    ready: Effect.sync(() => asked++).pipe(Effect.andThen(Deferred.await(gate)), Effect.as(null)),
  })

  const { unblocked, askedByThose, answered } = await withServer(db, pathRead, (client) =>
    Effect.gen(function* () {
      const unblocked = {
        sessions: yield* client["session.list"]({ projectPath: project }),
        tabs: yield* client["tab.list"]({ projectPath: project }),
        items: yield* client["transcript.getItems"]({
          sessionId: session.id,
          position: null,
          before: 100,
          after: 100,
        }),
      }
      const askedByThose = asked

      const listing = yield* client["worktree.list"]({ projectPath: project }).pipe(
        Effect.forkChild,
      )
      const sending = yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
      }).pipe(Effect.forkChild)

      // Each reaches the read before doing anything, and neither can end before it does.
      yield* Effect.promise(() => expect.poll(() => asked).toBe(2))
      expect(listing.pollUnsafe()).toBeUndefined()
      expect(sending.pollUnsafe()).toBeUndefined()

      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(listing)
      yield* Fiber.join(sending)
      return { unblocked, askedByThose, answered: true }
    }),
  )

  expect(unblocked.sessions).toHaveLength(1)
  expect(unblocked.tabs).toBeDefined()
  expect(unblocked.items.items).toEqual([])
  expect(askedByThose).toBe(0)
  expect(answered).toBe(true)
})
