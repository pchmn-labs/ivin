import { layerScripted } from "@ivin/harness"
import type { ScriptedElement } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Duration, Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { join } from "node:path"
import { layerChildPluginHost } from "../modules/plugin/adapters/child-plugin-host.ts"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"
import { runPluginHost } from "../modules/plugin/usecases/run-plugin-host.ts"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { DatabaseSync } from "node:sqlite"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { tempDir, type Client } from "./plugin-test-server.ts"

export const hostEntry = join(import.meta.dirname, "../plugin-host.ts")

export interface PluginServerOptions {
  readonly database?: string
  readonly scripted?: Parameters<typeof layerScripted>[1]
  readonly turns?: readonly (readonly ScriptedElement[])[]
}

// A server whose plugin host runs the server halves of the plugins in `home`.
export const withPluginServer = <A, E>(
  home: string,
  use: (client: Client) => Effect.Effect<A, E>,
  { database = ":memory:", scripted, turns = [] }: PluginServerOptions = {},
) => {
  const db = new DatabaseSync(database)
  Effect.runSync(runMigrations(db))
  db.prepare("INSERT OR IGNORE INTO trusted_projects (path) VALUES ('/')").run()
  return Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.forkScoped(
        runPluginHost({
          heartbeatEvery: Duration.millis(100),
          heartbeatTimeout: Duration.seconds(5),
          restartDelay: Duration.millis(10),
        }),
      )
      const client = yield* RpcTest.makeClient(Rpcs)
      return yield* use(client)
    }).pipe(
      Effect.provide(
        handlers.pipe(
          Layer.provideMerge(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(Layer.succeed(ImageFolder)({ path: tempDir("images") })),
          Layer.provide(layerScripted(turns, scripted)),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provideMerge(layerFsUserPlugins(home)),
          Layer.provideMerge(layerChildPluginHost(process.execPath, hostEntry)),
        ),
      ),
      Effect.scoped,
    ),
  ).finally(() => db.close())
}
