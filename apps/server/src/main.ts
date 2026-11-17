import { demoScript, layerScripted } from "@ivin/harness"
import { Cause, Effect, Layer } from "effect"
import { parseArgs } from "node:util"
import pkg from "../package.json" with { type: "json" }
import { serveOverPort } from "./rpc/serve.ts"
import { layerDatabase } from "./shared/adapters/database.ts"

interface MainPort {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  postMessage(data: string): void
  start(): void
}

// Electron adds `parentPort` to `process` inside a utilityProcess.
const { parentPort } = process as unknown as {
  parentPort: { on(event: "message", listener: (event: { ports: MainPort[] }) => void): void }
}

const {
  values: { database: databasePath },
} = parseArgs({ options: { database: { type: "string" } }, strict: false })

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
if (typeof databasePath !== "string") fail("Missing --database <path>")
const path = databasePath as string

// Until the Claude provider lands, unset means scripted.
const harnessId = process.env["IVIN_HARNESS"] ?? "scripted"
if (harnessId !== "scripted") fail(`Unknown IVIN_HARNESS "${harnessId}": only "scripted" exists.`)
const layerHarness = layerScripted(demoScript)

// Ports main posts before the database is ready wait here.
let serve: ((port: MainPort) => void) | undefined
const waiting: MainPort[] = []

// Each port main hands over is one client; a window reload brings a new one.
parentPort.on("message", ({ ports: [port] }) => {
  if (!port) return
  if (serve) serve(port)
  else waiting.push(port)
})

// One connection for the whole process, shared by every port.
const startup = Effect.gen(function* () {
  const context = yield* Layer.build(Layer.mergeAll(layerDatabase(path), layerHarness))
  serve = (port) => {
    const server = serveOverPort(
      {
        onMessage: (handler) => port.on("message", (event) => handler(event.data)),
        postMessage: (data) => port.postMessage(data),
      },
      { version: pkg.version },
    ).pipe(Layer.provide(Layer.succeedContext(context)))
    Effect.runFork(Layer.launch(server))
    port.start()
  }
  waiting.splice(0).forEach(serve)
  return yield* Effect.never
}).pipe(Effect.scoped)

Effect.runFork(
  startup.pipe(
    Effect.catchTag("DatabaseSchemaTooNew", (error) => Effect.sync(() => fail(error.message))),
    Effect.catchCause((cause) => Effect.sync(() => fail(Cause.pretty(cause)))),
  ),
)
