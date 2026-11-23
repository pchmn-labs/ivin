import { CliSocketRpcs } from "@ivin/contracts/rpcs"
import { layerClientProtocolMessagePort } from "@ivin/state/rpc-client-protocol"
import { Context, Data, Effect } from "effect"
import { RpcClient, type RpcClientError } from "effect/rpc"
import { connect, type Socket } from "node:net"
import { homedir } from "node:os"
import { join } from "node:path"

export class Server extends Context.Service<
  Server,
  {
    readonly client: RpcClient.FromGroup<typeof CliSocketRpcs, RpcClientError.RpcClientError>
    readonly socketPath: string
  }
>()("ivin/cli/Server") {}

export class NotRunning extends Data.TaggedError("NotRunning")<{ readonly socketPath: string }> {}

export class ConnectionFailed extends Data.TaggedError("ConnectionFailed")<{
  readonly socketPath: string
  readonly cause: unknown
}> {}

// Null when the app that started this agent could not serve its socket.
export const socketPathOf = (env: NodeJS.ProcessEnv): string | null =>
  env["IVIN_SOCKET"] === ""
    ? null
    : (env["IVIN_SOCKET"] ?? join(env["IVIN_HOME"] ?? join(homedir(), ".ivin"), "run", "ivin.sock"))

// The app is not running when nothing listens: no socket file, or one left by a crash.
const isNotListening = (error: NodeJS.ErrnoException) =>
  error.code === "ENOENT" || error.code === "ECONNREFUSED"

const open = (socketPath: string) =>
  Effect.acquireRelease(
    Effect.callback<Socket, NotRunning | ConnectionFailed>((resume) => {
      const socket = connect(socketPath)
      socket.once("connect", () => resume(Effect.succeed(socket)))
      socket.once("error", (error: NodeJS.ErrnoException) =>
        resume(
          Effect.fail(
            isNotListening(error)
              ? new NotRunning({ socketPath })
              : new ConnectionFailed({ socketPath, cause: error }),
          ),
        ),
      )
    }),
    (socket) => Effect.sync(() => socket.destroy()),
  )

// Longer lines close the connection; a plugin's log is the longest answer.
const maxLineLength = 64 * 1024 * 1024

// One JSON message per line, as the server frames them.
const portOf = (socket: Socket) => ({
  onMessage: (handler: (data: unknown) => void) => {
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
  },
  postMessage: (data: string) => {
    socket.write(`${data}\n`)
  },
})

// Fails with NotRunning when the app quits before answering, instead of waiting forever.
const closed = (socket: Socket, socketPath: string) =>
  Effect.callback<never, NotRunning>((resume) => {
    socket.once("close", () => resume(Effect.fail(new NotRunning({ socketPath }))))
  })

export const withServer = <A, E, R>(
  socketPath: string,
  use: Effect.Effect<A, E, R | Server>,
): Effect.Effect<A, E | NotRunning | ConnectionFailed, Exclude<R, Server>> =>
  Effect.gen(function* () {
    const socket = yield* open(socketPath)
    // The process exits once the command is done; an error after that has no one to tell.
    socket.on("error", () => undefined)
    const client = yield* RpcClient.make(CliSocketRpcs).pipe(
      Effect.provide(layerClientProtocolMessagePort(portOf(socket))),
    )
    return yield* Effect.raceFirst(
      use.pipe(Effect.provideService(Server, { client, socketPath })),
      closed(socket, socketPath),
    )
  }).pipe(Effect.scoped)
