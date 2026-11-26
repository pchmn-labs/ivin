import {
  HOST_MODULES_GLOBAL,
  PluginActivateFailed,
  PluginHandlerFailed,
  PluginHostRpcs,
} from "@ivin/contracts/plugin"
import type { HostCall, HostLog, HostReply } from "@ivin/contracts/plugin"
import { layerProtocolMessagePort } from "@ivin/state/rpc-server-protocol"
import * as pluginApiServer from "@ivin/plugin-api/server"
import { Effect, Layer, Queue, Stream } from "effect"
import { RpcServer } from "effect/rpc"
import { AsyncLocalStorage } from "node:async_hooks"
import { format } from "node:util"
import { pathToFileURL } from "node:url"
import { makePluginContext } from "./modules/plugin/adapters/plugin-context.ts"

const send = process.send?.bind(process)
if (send === undefined) throw new Error("The plugin host runs as a child of ivin's server.")

// Which plugin's code is running, through every await, timer and callback it starts.
const running = new AsyncLocalStorage<string>()
const logs = Effect.runSync(Queue.unbounded<HostLog>())
const write = (id: string, line: string) => void Effect.runSync(Queue.offer(logs, { id, line }))

for (const level of ["log", "info", "warn", "error", "debug"] as const) {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    const id = running.getStore()
    if (id === undefined) return original(...args)
    write(id, level === "log" ? format(...args) : `${level}: ${format(...args)}`)
  }
}

// A throw or a rejection after `activate` returned is the plugin's own: logged, the host goes on.
const reportUncaught = (error: unknown) => {
  const id = running.getStore()
  const text = error instanceof Error ? (error.stack ?? error.message) : String(error)
  if (id === undefined) process.stderr.write(`plugin host: uncaught ${text}\n`)
  else write(id, `error: ${text}`)
}
process.on("uncaughtException", reportUncaught)
process.on("unhandledRejection", reportUncaught)

Object.assign(globalThis, {
  [HOST_MODULES_GLOBAL]: { "@ivin/plugin-api/server": pluginApiServer },
})

const active = new Map<string, ReturnType<typeof makePluginContext>>()

const calls = Effect.runSync(Queue.unbounded<HostCall>())
const pending = new Map<
  number,
  { readonly resolve: (value: unknown) => void; readonly reject: (error: Error) => void }
>()
let lastCallId = 0

const callServer = (id: string, method: string, args: unknown) =>
  new Promise<unknown>((resolve, reject) => {
    lastCallId += 1
    pending.set(lastCallId, { resolve, reject })
    Effect.runSync(
      Queue.offer(calls, { callId: lastCallId, id, method, args: args as HostCall["args"] }),
    )
  })

const reply = ({ callId, failure, value }: HostReply) => {
  const waiting = pending.get(callId)
  pending.delete(callId)
  if (failure === null) waiting?.resolve(value)
  else waiting?.reject(new Error(failure))
}

const activate = (id: string, file: string) =>
  running.run(id, async () => {
    // The file name holds a hash of its content, so a changed plugin is a new module.
    const module = (await import(pathToFileURL(file).href)) as { activate?: unknown }
    if (typeof module.activate !== "function") {
      throw new Error("The server half exports no activate function.")
    }
    const context = makePluginContext((method, args) => callServer(id, method, args) as never)
    active.set(id, context)
    await module.activate(context.ctx)
    await context.registered()
  })

const dispatch = (id: string, kind: string, payload: unknown) =>
  running.run(id, async () => {
    const context = active.get(id)
    if (context === undefined) throw new Error("The plugin is not active.")
    return context.dispatch(kind, payload as never)
  })

const deactivate = (id: string) =>
  running.run(id, () => {
    const context = active.get(id)
    active.delete(id)
    for (const failure of context?.dispose() ?? []) reportUncaught(failure)
  })

const handlers = PluginHostRpcs.toLayer(
  PluginHostRpcs.of({
    "pluginHost.activate": ({ id, file }) =>
      Effect.tryPromise({
        try: () => activate(id, file),
        catch: (error) =>
          new PluginActivateFailed({
            reason: error instanceof Error ? error.message : String(error),
          }),
      }),
    "pluginHost.deactivate": ({ id }) => Effect.sync(() => deactivate(id)),
    "pluginHost.ping": () => Effect.void,
    "pluginHost.logs": () => Stream.fromQueue(logs),
    "pluginHost.calls": () => Stream.fromQueue(calls),
    "pluginHost.reply": ({ reply: answer }) => Effect.sync(() => reply(answer)),
    "pluginHost.dispatch": ({ id, kind, payload }) =>
      Effect.tryPromise({
        try: () => dispatch(id, kind, payload),
        catch: (error) =>
          new PluginHandlerFailed({
            reason: error instanceof Error ? error.message : String(error),
          }),
      }) as Effect.Effect<never, PluginHandlerFailed>,
  }),
)

const port = {
  onMessage: (handler: (data: unknown) => void) => process.on("message", handler),
  postMessage: (data: string) => void send(data),
}

// The server's end closing the channel is the signal to stop.
process.on("disconnect", () => process.exit(0))

Effect.runFork(
  Layer.launch(
    RpcServer.layer(PluginHostRpcs, { disableFatalDefects: true }).pipe(
      Layer.provide(handlers),
      Layer.provide(layerProtocolMessagePort(port)),
    ),
  ),
)
send({ type: "ready" })
