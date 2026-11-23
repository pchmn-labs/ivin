import { Data, Effect, Fiber, type Scope } from "effect"
import { chmod, mkdir, unlink } from "node:fs/promises"
import { connect, createServer, type Server, type Socket } from "node:net"
import { dirname } from "node:path"
import type { RpcServerPort } from "@ivin/state/rpc-server-protocol"

export class SocketInUse extends Data.TaggedError("SocketInUse")<{ readonly path: string }> {}

export class SocketListenFailed extends Data.TaggedError("SocketListenFailed")<{
  readonly path: string
  readonly cause: unknown
}> {}

const answers = (path: string) =>
  new Promise<boolean>((resolve) => {
    const probe = connect(path)
    probe.once("connect", () => {
      probe.destroy()
      resolve(true)
    })
    probe.once("error", () => resolve(false))
  })

const removeIfStale = (path: string) =>
  Effect.tryPromise({
    try: () => answers(path),
    catch: (cause) => new SocketListenFailed({ path, cause }),
  }).pipe(
    Effect.flatMap((live) =>
      live
        ? Effect.fail(new SocketInUse({ path }))
        : Effect.promise(() => unlink(path).catch(() => undefined)),
    ),
  )

const listen = (path: string, server: Server) =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      // Connecting needs the folder's permission, so no one else gets in before the chmod.
      await chmod(dirname(path), 0o700)
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject)
        server.listen(path, () => {
          server.off("error", reject)
          resolve()
        })
      })
      await chmod(path, 0o600)
    },
    catch: (cause) => new SocketListenFailed({ path, cause }),
  })

// Longer lines close the connection; the CLI's requests are a few hundred bytes.
const maxLineLength = 1024 * 1024

// One JSON message per line.
const portOf = (socket: Socket): RpcServerPort => ({
  onMessage: (handler) => {
    let buffered = ""
    socket.setEncoding("utf8")
    socket.on("data", (chunk: string) => {
      buffered += chunk
      let end = buffered.indexOf("\n")
      while (end !== -1) {
        const line = buffered.slice(0, end)
        buffered = buffered.slice(end + 1)
        if (line.length > maxLineLength) return socket.destroy()
        if (line !== "") handler(line)
        end = buffered.indexOf("\n")
      }
      if (buffered.length > maxLineLength) socket.destroy()
    })
    socket.resume()
  },
  postMessage: (data) => {
    if (!socket.destroyed) socket.write(`${data}\n`)
  },
})

// Serves each connection with `serve` until it closes; the file is removed when the scope closes.
export const listenOnUnixSocket = <R>(
  path: string,
  serve: (port: RpcServerPort) => Effect.Effect<never, unknown, R>,
): Effect.Effect<void, SocketInUse | SocketListenFailed, R | Scope.Scope> =>
  Effect.gen(function* () {
    yield* removeIfStale(path)
    const run = Effect.runForkWith(yield* Effect.context<R>())
    const connections = new Set<Socket>()
    const server = createServer((socket) => {
      connections.add(socket)
      // Held until the RPC server listens, or its first request would be lost.
      socket.pause()
      // A client that vanishes mid-write must not crash the server.
      socket.on("error", () => socket.destroy())
      const fiber = run(serve(portOf(socket)))
      socket.once("close", () => {
        connections.delete(socket)
        run(Fiber.interrupt(fiber))
      })
    })
    yield* Effect.acquireRelease(listen(path, server), () =>
      Effect.promise(async () => {
        for (const socket of connections) socket.destroy()
        await new Promise((resolve) => server.close(resolve))
        await unlink(path).catch(() => undefined)
      }),
    )
  })
