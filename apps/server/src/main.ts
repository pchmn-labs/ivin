import { Effect, Layer } from "effect"
import { RpcServer } from "effect/rpc"
import { ServerRpcs } from "@ivin/contracts/server"
import pkg from "../package.json" with { type: "json" }
import { handlers } from "./rpc/handlers.ts"
import { layerProtocolMessagePort } from "./shared/message-port-protocol.ts"
import { ServerInfo } from "./shared/server-info.ts"

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
  const server = RpcServer.layer(ServerRpcs).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.succeed(ServerInfo)({ version: pkg.version })),
    Layer.provide(
      layerProtocolMessagePort({
        onMessage: (handler) => port.on("message", (event) => handler(event.data)),
        postMessage: (data) => port.postMessage(data),
      }),
    ),
  )
  Effect.runFork(Layer.launch(server))
  port.start()
})
