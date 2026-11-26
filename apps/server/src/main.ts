import {
  demoApprovalScript,
  demoPrScript,
  demoQuestionScript,
  demoScript,
  demoAgentCommands,
  demoShotScript,
  layerClaude,
  layerScripted,
} from "@ivin/harness"
import { Cause, Deferred, Effect, Fiber, Layer } from "effect"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { defaultSettingsFor } from "@ivin/contracts/setting"
import pkg from "../package.json" with { type: "json" }
import {
  LOGIN_SHELL_TIMEOUT_MS,
  layerFsShellCommand,
  readLoginShellPath,
} from "./modules/cli/adapters/fs-shell-command.ts"
import { agentPath } from "./modules/cli/rules/agent-path.ts"
import { layerErrorLogFile } from "./modules/log/adapters/error-log-file.ts"
import { layerFsKeybindingsFile } from "./modules/keybinding/adapters/fs-keybindings-file.ts"
import { layerChildPluginHost } from "./modules/plugin/adapters/child-plugin-host.ts"
import { watchPluginFolders } from "./modules/plugin/usecases/watch-plugin-folders.ts"
import { layerPluginHostAfterLoginShellPath } from "./modules/plugin/usecases/plugin-host.ts"
import { runPluginHost } from "./modules/plugin/usecases/run-plugin-host.ts"
import { layerFsBuiltinPlugins } from "./modules/plugin/adapters/fs-builtin-plugins.ts"
import { layerFsUserPlugins } from "./modules/plugin/adapters/fs-user-plugins.ts"
import { layerFsSettingsFile } from "./modules/setting/adapters/fs-settings-file.ts"
import { SettingDefaults } from "./modules/setting/usecases/setting-defaults.ts"
import { layerFsSkillInstallation } from "./modules/skill/adapters/fs-skill-install.ts"
import { layerServices } from "./rpc/handlers.ts"
import { serveOverClosingPort, serveOverSocket } from "./rpc/serve.ts"
import {
  layerHarnessAfterLoginShellPath,
  LoginShellPath,
} from "./shared/usecases/login-shell-path.ts"
import { layerDatabase } from "./shared/adapters/database.ts"
import { WorkingFolderRoot } from "./modules/project/usecases/working-folder-root.ts"
import { ImageFolder } from "./modules/transcript/usecases/image-folder.ts"

interface MainPort {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  on(event: "close", listener: () => void): void
  postMessage(data: string): void
  start(): void
}

// Electron adds `parentPort` to `process` inside a utilityProcess.
const { parentPort } = process as unknown as {
  parentPort: {
    on(event: "message", listener: (event: { data: unknown; ports: MainPort[] }) => void): void
    postMessage(message: unknown): void
  }
}

const {
  values: {
    database: databasePath,
    log: logPath,
    home: homePath,
    images: imagesPath,
    skills: skillsPath,
    pnpm: pnpmPath,
    "plugin-tools": pluginToolsPath,
    "cli-command": cliCommandPath,
    "plugin-host": pluginHostPath,
    "plugin-host-runtime": pluginHostRuntime,
    "builtin-plugins": builtinPluginsPath,
    safe: safeMode,
  },
} = parseArgs({
  options: {
    database: { type: "string" },
    log: { type: "string" },
    home: { type: "string" },
    images: { type: "string" },
    skills: { type: "string" },
    pnpm: { type: "string" },
    "plugin-tools": { type: "string" },
    "cli-command": { type: "string" },
    "plugin-host": { type: "string" },
    "plugin-host-runtime": { type: "string" },
    "builtin-plugins": { type: "string" },
    safe: { type: "boolean" },
  },
  strict: false,
})

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
if (typeof databasePath !== "string") fail("Missing --database <path>")
if (typeof logPath !== "string") fail("Missing --log <path>")
const path = databasePath as string
const layerLogger = layerErrorLogFile(logPath as string)
if (typeof homePath !== "string") fail("Missing --home <path>, the folder of the user's files")
const ivinHome = homePath as string
if (typeof imagesPath !== "string") fail("Missing --images <path>, the folder of the sent images")
const imageFolder = imagesPath as string
if (typeof skillsPath !== "string") fail("Missing --skills <path>, the folder of ivin's skills")
const skillsSource = skillsPath as string
if (typeof pnpmPath !== "string") fail("Missing --pnpm <path>, the folder of the pnpm ivin ships")
const pnpmFolder = pnpmPath as string
const loginShell = process.env["SHELL"] || "/bin/zsh"
const loginShellFolders = Effect.runSync(Deferred.make<ReadonlyArray<string> | null>())
const loginShellPath = { ready: Deferred.await(loginShellFolders) }
// Provided to each layer that waits for it: a sibling in `Layer.mergeAll` would only see the default.
const layerLoginShellPath = Layer.succeed(LoginShellPath)(loginShellPath)
const layerShellCommand =
  typeof cliCommandPath === "string"
    ? layerFsShellCommand({
        command: cliCommandPath,
        home: homedir(),
        folders: ["/usr/local/bin", join(homedir(), ".local", "bin")],
        shellPath: loginShellPath.ready,
      })
    : Layer.empty
// Without them the server runs no plugin's server half.
const layerPluginHost =
  typeof pluginHostPath === "string"
    ? layerPluginHostAfterLoginShellPath(
        layerChildPluginHost(
          typeof pluginHostRuntime === "string" ? pluginHostRuntime : process.execPath,
          pluginHostPath,
        ),
      ).pipe(Layer.provide(layerLoginShellPath))
    : Layer.empty
const socketPath = process.env["IVIN_SOCKET"]
if (socketPath === undefined) fail("Missing IVIN_SOCKET, the path of the CLI socket")

const harnessId = process.env["IVIN_HARNESS"] ?? "claude"
const layerHarnesses = {
  claude: layerClaude,
  scripted: layerScripted(demoScript, { cycle: true }),
  "scripted-approval": layerScripted(demoApprovalScript),
  "scripted-question": layerScripted(demoQuestionScript),
  "scripted-pr": layerScripted(demoPrScript),
  "scripted-shot": layerScripted(demoShotScript, {
    listCommands: () => Effect.succeed(demoAgentCommands),
  }),
} as const
if (!(harnessId in layerHarnesses)) {
  fail(
    `Unknown IVIN_HARNESS "${harnessId}": expected ${Object.keys(layerHarnesses)
      .map((id) => `"${id}"`)
      .join(" or ")}.`,
  )
}
const layerHarness = layerHarnesses[harnessId as keyof typeof layerHarnesses]

const adoptLoginShellPath = Effect.gen(function* () {
  const shellFolders = yield* readLoginShellPath(loginShell, LOGIN_SHELL_TIMEOUT_MS)
  if (shellFolders === null) {
    yield* Effect.logWarning(`could not read the PATH of ${loginShell}; agents keep the app's`)
  } else {
    yield* Effect.sync(() => {
      process.env["PATH"] = agentPath(process.env["PATH"] ?? "", shellFolders)
    })
  }
  yield* Deferred.succeed(loginShellFolders, shellFolders)
})

// Ports main posts before the database is ready wait here.
let serve: ((port: MainPort) => void) | undefined
const waiting: MainPort[] = []
const launched = new Set<Fiber.Fiber<unknown, unknown>>()

// Each port main hands over is one client; a window reload brings a new one.
parentPort.on("message", ({ data, ports: [port] }) => {
  if ((data as { type?: unknown } | null)?.type === "shutdown") return shutdown()
  if (!port) return
  if (serve) serve(port)
  else waiting.push(port)
})

// Stores, feeds and runs are built once here: every port, and so every window reload, shares them.
const startup = Effect.gen(function* () {
  // Read in the background: only git and agents wait for it, through `LoginShellPath`.
  if (harnessId === "claude") yield* Effect.forkScoped(adoptLoginShellPath)
  else yield* Deferred.succeed(loginShellFolders, null)
  const context = yield* Layer.build(
    Layer.mergeAll(layerServices, layerFsSkillInstallation(skillsSource)).pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          layerDatabase(path),
          Layer.succeed(ImageFolder)({ path: imageFolder }),
          Layer.succeed(WorkingFolderRoot)({ path: join(ivinHome, "worktrees") }),
          layerHarnessAfterLoginShellPath(layerHarness).pipe(Layer.provide(layerLoginShellPath)),
          layerLoginShellPath,
          layerLogger,
          layerFsKeybindingsFile(ivinHome),
          layerFsSettingsFile(ivinHome),
          Layer.succeed(SettingDefaults)(defaultSettingsFor(pkg.version)),
          layerFsUserPlugins(
            ivinHome,
            pnpmFolder,
            typeof pluginToolsPath === "string" ? pluginToolsPath : undefined,
            { safe: safeMode === true },
          ),
          typeof builtinPluginsPath === "string"
            ? layerFsBuiltinPlugins(builtinPluginsPath)
            : Layer.empty,
          layerShellCommand,
          layerPluginHost,
        ),
      ),
    ),
  )
  yield* Effect.forkScoped(
    runPluginHost().pipe(
      Effect.provide(context),
      Effect.catchCause((cause) => Effect.logError("the plugin host runner stopped", cause)),
    ),
  )
  yield* Effect.forkScoped(
    watchPluginFolders.pipe(
      Effect.provide(context),
      Effect.catchCause((cause) => Effect.logError("the plugin folders watcher stopped", cause)),
    ),
  )
  serve = (port) => {
    const fiber = Effect.runFork(
      serveOverClosingPort(
        {
          onMessage: (handler) => port.on("message", (event) => handler(event.data)),
          onClose: (handler) => port.on("close", handler),
          postMessage: (data) => port.postMessage(data),
        },
        { version: pkg.version },
      ).pipe(Effect.provide(Layer.succeedContext(context))),
    )
    launched.add(fiber)
    fiber.addObserver(() => launched.delete(fiber))
    port.start()
  }
  waiting.splice(0).forEach(serve)
  // Main restarts a server that stops, and waits for this before it says the window may connect.
  parentPort.postMessage({ type: "ready" })
  // Without the socket the window still works; only `ivin` commands fail.
  yield* serveOverSocket(socketPath as string, { version: pkg.version }).pipe(
    Effect.provide(context),
    Effect.catch((error) =>
      Effect.logError("could not serve the CLI socket", error).pipe(
        // Empty tells this app's agents it serves no socket, rather than sending them to another app.
        Effect.andThen(Effect.sync(() => (process.env["IVIN_SOCKET"] = ""))),
      ),
    ),
  )
  return yield* Effect.never
}).pipe(Effect.scoped)

// The log is where the window's message tells the user to look.
const failAfterLogging = (message: string) =>
  Effect.logError(message).pipe(Effect.andThen(Effect.sync(() => fail(message))))

const startupFiber = Effect.runFork(
  startup.pipe(
    Effect.catchTag("DatabaseSchemaTooNew", (error) => failAfterLogging(error.message)),
    Effect.catchCause((cause) => failAfterLogging(Cause.pretty(cause))),
    Effect.provide(layerLogger),
  ),
)

// Closing the scopes runs the finalizers that kill the agent processes; exiting directly would orphan them.
let stopping = false
const shutdown = () => {
  if (stopping) return
  stopping = true
  void Effect.runPromise(
    Fiber.interruptAll([...launched, startupFiber]).pipe(
      // Must exceed the harness kill grace (2 s) and stay under the desktop's 5 s quit timeout.
      Effect.timeout("3 seconds"),
      Effect.ignore,
    ),
  ).finally(() => process.exit(0))
}
process.on("SIGTERM", shutdown)
