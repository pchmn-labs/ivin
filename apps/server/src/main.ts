import {
  demoApprovalScript,
  demoScript,
  demoShotScript,
  layerClaude,
  layerScripted,
} from "@ivin/harness"
import { Cause, Effect, Fiber, Layer } from "effect"
import { parseArgs } from "node:util"
import pkg from "../package.json" with { type: "json" }
import { layerErrorLogFile } from "./modules/log/adapters/error-log-file.ts"
import { layerFsKeybindingsFile } from "./modules/keybinding/adapters/fs-keybindings-file.ts"
import { layerFsSettingsFile } from "./modules/setting/adapters/fs-settings-file.ts"
import { layerFsSkillInstallation } from "./modules/skill/adapters/fs-skill-install.ts"
import { layerServices } from "./rpc/handlers.ts"
import { serveOverPort, serveOverSocket } from "./rpc/serve.ts"
import { layerDatabase } from "./shared/adapters/database.ts"
import { ImageFolder } from "./modules/transcript/usecases/image-folder.ts"

interface MainPort {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  postMessage(data: string): void
  start(): void
}

// Electron adds `parentPort` to `process` inside a utilityProcess.
const { parentPort } = process as unknown as {
  parentPort: {
    on(event: "message", listener: (event: { data: unknown; ports: MainPort[] }) => void): void
  }
}

const {
  values: {
    database: databasePath,
    log: logPath,
    home: homePath,
    images: imagesPath,
    skill: skillPath,
  },
} = parseArgs({
  options: {
    database: { type: "string" },
    log: { type: "string" },
    home: { type: "string" },
    images: { type: "string" },
    skill: { type: "string" },
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
if (typeof skillPath !== "string") fail("Missing --skill <path>, the folder of ivin's skill")
const skillFolder = skillPath as string
const socketPath = process.env["IVIN_SOCKET"]
if (socketPath === undefined) fail("Missing IVIN_SOCKET, the path of the CLI socket")

const harnessId = process.env["IVIN_HARNESS"] ?? "claude"
const layerHarnesses = {
  claude: layerClaude,
  scripted: layerScripted(demoScript, { cycle: true }),
  "scripted-approval": layerScripted(demoApprovalScript),
  "scripted-shot": layerScripted(demoShotScript),
} as const
if (!(harnessId in layerHarnesses)) {
  fail(
    `Unknown IVIN_HARNESS "${harnessId}": expected ${Object.keys(layerHarnesses)
      .map((id) => `"${id}"`)
      .join(" or ")}.`,
  )
}
const layerHarness = layerHarnesses[harnessId as keyof typeof layerHarnesses]

// Ports main posts before the database is ready wait here.
let serve: ((port: MainPort) => void) | undefined
const waiting: MainPort[] = []
const launched: Fiber.Fiber<never, unknown>[] = []

// Each port main hands over is one client; a window reload brings a new one.
parentPort.on("message", ({ data, ports: [port] }) => {
  if ((data as { type?: unknown } | null)?.type === "shutdown") return shutdown()
  if (!port) return
  if (serve) serve(port)
  else waiting.push(port)
})

// Stores, feeds and runs are built once here: every port, and so every window reload, shares them.
const startup = Effect.gen(function* () {
  const context = yield* Layer.build(
    Layer.mergeAll(layerServices, layerFsSkillInstallation(skillFolder)).pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          layerDatabase(path),
          Layer.succeed(ImageFolder)({ path: imageFolder }),
          layerHarness,
          layerLogger,
          layerFsKeybindingsFile(ivinHome),
          layerFsSettingsFile(ivinHome),
        ),
      ),
    ),
  )
  serve = (port) => {
    const server = serveOverPort(
      {
        onMessage: (handler) => port.on("message", (event) => handler(event.data)),
        postMessage: (data) => port.postMessage(data),
      },
      { version: pkg.version },
    ).pipe(Layer.provide(Layer.succeedContext(context)))
    launched.push(Effect.runFork(Layer.launch(server)))
    port.start()
  }
  waiting.splice(0).forEach(serve)
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

const startupFiber = Effect.runFork(
  startup.pipe(
    Effect.provide(layerLogger),
    Effect.catchTag("DatabaseSchemaTooNew", (error) => Effect.sync(() => fail(error.message))),
    Effect.catchCause((cause) => Effect.sync(() => fail(Cause.pretty(cause)))),
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
