import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted, type ScriptedElement } from "@ivin/harness"
import { Effect, Layer, type Scope } from "effect"
import { RpcTest } from "effect/rpc"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { WorkingFolderRoot } from "../modules/project/usecases/working-folder-root.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"

export const makeClient = () => RpcTest.makeClient(Rpcs)
export type Client = Effect.Success<ReturnType<typeof makeClient>>

// Kept by a test that starts a second server on the same data, as a restart does.
export const newDatabase = ({ trusted = true }: { trusted?: boolean } = {}) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  if (trusted) trustEveryFolder(db)
  return db
}

interface ServerOptions {
  readonly db?: DatabaseSync
  readonly turns?: readonly (readonly ScriptedElement[])[]
  readonly scripted?: Parameters<typeof layerScripted>[1]
  readonly settings?: ReadonlyArray<string | null>
  readonly keybindings?: ReadonlyArray<string | null>
  readonly imageFolder?: string
  readonly workingFolderRoot?: string
  readonly services?: typeof layerServices
}

// A service the options do not cover is provided to this layer by the test file.
export const serverLayer = ({
  db = newDatabase(),
  turns = [],
  scripted,
  settings = [],
  keybindings = [],
  imageFolder = mkdtempSync(join(tmpdir(), "ivin-images-")),
  workingFolderRoot = mkdtempSync(join(tmpdir(), "ivin-worktrees-")),
  services = layerServices,
}: ServerOptions = {}) =>
  handlers.pipe(
    Layer.provideMerge(services),
    Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
    Layer.provideMerge(Layer.succeed(Database)(db)),
    Layer.provide(Layer.succeed(ImageFolder)({ path: imageFolder })),
    Layer.provide(Layer.succeed(WorkingFolderRoot)({ path: workingFolderRoot })),
    Layer.provide(layerKeybindingsFileOf(keybindings)),
    Layer.provideMerge(layerSettingsFileOf(settings)),
    Layer.provide(layerScripted(turns, scripted)),
  )

type ServerServices = Layer.Success<ReturnType<typeof serverLayer>>

export const withServer = <A, E>(
  use: (client: Client) => Effect.Effect<A, E, ServerServices | Scope.Scope>,
  options?: ServerOptions,
) =>
  Effect.runPromise(
    makeClient().pipe(Effect.flatMap(use), Effect.provide(serverLayer(options)), Effect.scoped),
  )
