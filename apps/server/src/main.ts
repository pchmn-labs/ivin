import { Effect, Layer } from "effect"
import pkg from "../package.json" with { type: "json" }
import { serveOverPort } from "./rpc/serve.ts"

interface MainPort {
  on(event: "message", listener: (event: { data: unknown }) => void): void
  postMessage(data: string): void
  start(): void
}

// Electron adds `parentPort` to `process` inside a utilityProcess.
const { parentPort } = process as unknown as {
  parentPort: { on(event: "message", listener: (event: { ports: MainPort[] }) => void): void }
}

// Each port main hands over is one client; a window reload brings a new one.
parentPort.on("message", ({ ports: [port] }) => {
  if (!port) return
  const server = serveOverPort(
    {
      onMessage: (handler) => port.on("message", (event) => handler(event.data)),
      postMessage: (data) => port.postMessage(data),
    },
    { version: pkg.version },
  )
  Effect.runFork(Layer.launch(server))
  port.start()
})
