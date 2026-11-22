import type { SkillInstall } from "@ivin/contracts/server"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { execFile, execFileSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { layerFsSettingsFile } from "../modules/setting/adapters/fs-settings-file.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { SkillInstallation } from "../modules/skill/usecases/skill-installation.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { layerDatabase } from "../shared/adapters/database.ts"
import { layerServices } from "./handlers.ts"
import { serveOverSocket } from "./serve.ts"

const cliFolder = join(import.meta.dirname, "../../../cli")

let cliPath: string | null = null

// Built once per test file, as the app ships it; a test calls it before running `ivin`.
// Each file builds into its own folder: the build empties its output folder first.
export const buildCli = () => {
  const outDir = mkdtempSync(join(tmpdir(), "ivin-cli-"))
  execFileSync("pnpm", ["run", "build", "--out-dir", outDir], { cwd: cliFolder, stdio: "ignore" })
  cliPath = join(outDir, "ivin.js")
}

export interface CliRun {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

export const runCli = (args: readonly string[], env: Record<string, string> = {}) =>
  new Promise<CliRun>((resolve) => {
    if (cliPath === null) throw new Error("Call buildCli before runCli.")
    execFile(
      process.execPath,
      [cliPath, ...args],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) =>
        resolve({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr }),
    )
  })

// Unix socket paths stop at about 104 bytes on macOS.
export const tempSocketPath = () => join(mkdtempSync(join(tmpdir(), "ivin-")), "s.sock")

export interface CliServerOptions {
  readonly settings?: string | null
  // A real folder for settings.json, watched as the app does; `settings` is then ignored.
  readonly ivinHome?: string
  readonly keybindings?: string | null
  readonly version?: string
  readonly skill?: SkillInstall | null
}

const layerCliServer = ({
  settings = null,
  keybindings = null,
  ivinHome,
  skill = null,
}: CliServerOptions) =>
  layerServices.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        layerDatabase(":memory:"),
        Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
        layerScripted([]),
        ivinHome === undefined ? layerSettingsFileOf([settings]) : layerFsSettingsFile(ivinHome),
        layerKeybindingsFileOf([keybindings]),
        Layer.succeed(SkillInstallation)(skill),
      ),
    ),
  )
type CliServerServices = Layer.Success<ReturnType<typeof layerCliServer>>

// Runs a use case against the server's database, to set up a test or read what a command stored.
export type RunOnServer = <A, E>(effect: Effect.Effect<A, E, CliServerServices>) => Promise<A>

// Runs `use` while a server with an in-memory database answers on `socketPath`.
export const withCliServer = <A>(
  use: (socketPath: string, run: RunOnServer) => Promise<A>,
  { version = "1.2.3", ...options }: CliServerOptions = {},
) => {
  const socketPath = tempSocketPath()
  return Effect.gen(function* () {
    yield* serveOverSocket(socketPath, { version })
    const services = yield* Effect.context<CliServerServices>()
    const run: RunOnServer = (effect) => Effect.runPromise(Effect.provide(effect, services))
    return yield* Effect.promise(() => use(socketPath, run))
  }).pipe(Effect.provide(layerCliServer(options)), Effect.scoped, Effect.runPromise)
}
