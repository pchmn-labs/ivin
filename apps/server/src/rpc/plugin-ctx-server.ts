import type { ScriptedElement } from "@ivin/harness"
import { Duration, Effect, Layer } from "effect"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { layerChildPluginHost } from "../modules/plugin/adapters/child-plugin-host.ts"
import { layerFsBuiltinPlugins } from "../modules/plugin/adapters/fs-builtin-plugins.ts"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"
import { runPluginHost } from "../modules/plugin/usecases/run-plugin-host.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { makeClient, serverLayer } from "./test-server.ts"
import { type Client } from "./plugin-test-server.ts"
import type { layerScripted } from "@ivin/harness"

export const hostEntry = join(import.meta.dirname, "../plugin-host.ts")

export interface PluginServerOptions {
  // The database file, kept by a test that starts a second server on the same data.
  readonly database?: string
  readonly scripted?: Parameters<typeof layerScripted>[1]
  // The folder of the app's prebuilt plugins.
  readonly builtins?: string
  readonly turns?: readonly (readonly ScriptedElement[])[]
}

// A server whose plugin host runs the server halves of the plugins in `home`.
export const withPluginServer = <A, E>(
  home: string,
  use: (client: Client) => Effect.Effect<A, E>,
  { database = ":memory:", scripted, turns = [], builtins }: PluginServerOptions = {},
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
          maxActivations: 50,
        }),
      )
      const client = yield* makeClient()
      return yield* use(client)
    }).pipe(
      Effect.provide(
        serverLayer({ db, turns, ...(scripted === undefined ? {} : { scripted }) }).pipe(
          Layer.provideMerge(layerFsUserPlugins(home)),
          Layer.provideMerge(layerChildPluginHost(process.execPath, hostEntry)),
          Layer.provideMerge(
            builtins === undefined ? Layer.empty : layerFsBuiltinPlugins(builtins),
          ),
        ),
      ),
      Effect.scoped,
    ),
  ).finally(() => db.close())
}
