import { mkdtempSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AgentCommand } from "@ivin/contracts/session"
import { Rpcs } from "@ivin/contracts/rpcs"
import { HarnessError, layerScripted, type ScriptedOptions } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { WorkingFolderRoot } from "../modules/project/usecases/working-folder-root.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const review: AgentCommand = {
  name: "review",
  description: "Reviews the branch",
  argumentHint: "[branch]",
  kind: "skill",
  source: "project",
}

const withServer = <A, E>(
  options: ScriptedOptions,
  use: (client: Client, db: DatabaseSync) => Effect.Effect<A, E>,
) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap((client) => use(client, db)),
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
            Layer.succeed(WorkingFolderRoot)({
              path: mkdtempSync(join(tmpdir(), "ivin-worktrees-")),
            }),
          ),
          Layer.provide(layerScripted([], options)),
        ),
      ),
      Effect.scoped,
    ),
  )
}

test("a session's agent commands are the harness's, listed in its working folder", async () => {
  const folders: string[] = []
  const listed = await withServer(
    { listCommands: (cwd) => Effect.sync(() => (folders.push(cwd), [review])) },
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        return yield* client["session.listAgentCommands"]({ sessionId: created.id })
      }),
  )

  expect(listed).toEqual([review])
  expect(folders).toEqual(["/p"])
})

test("a harness without agent commands lists none", async () => {
  const listed = await withServer({}, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: "/p" })
      return yield* client["session.listAgentCommands"]({ sessionId: created.id })
    }),
  )

  expect(listed).toBeNull()
})

test("a harness that fails to list its commands fails with AgentCommandsNotListed", async () => {
  const error = await withServer(
    { listCommands: () => Effect.fail(new HarnessError({ message: "claude exited" })) },
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        return yield* Effect.flip(client["session.listAgentCommands"]({ sessionId: created.id }))
      }),
  )

  expect(error._tag).toBe("AgentCommandsNotListed")
})

test("an unknown session fails with SessionNotFound", async () => {
  const error = await withServer({ listCommands: () => Effect.succeed([review]) }, (client) =>
    Effect.flip(client["session.listAgentCommands"]({ sessionId: "nope" })),
  )

  expect(error._tag).toBe("SessionNotFound")
})

test("a folder the user no longer trusts is not asked, and fails with AgentCommandsNotListed", async () => {
  const folders: string[] = []
  const error = await withServer(
    { listCommands: (cwd) => Effect.sync(() => (folders.push(cwd), [review])) },
    (client, db) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: "/p" })
        db.prepare("DELETE FROM trusted_projects").run()
        return yield* Effect.flip(client["session.listAgentCommands"]({ sessionId: created.id }))
      }),
  )

  expect(error._tag).toBe("AgentCommandsNotListed")
  expect(folders).toEqual([])
})
