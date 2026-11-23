import { CliSocketRpcs, Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer } from "effect"
import { type Rpc, type RpcGroup, RpcServer } from "effect/rpc"
import { layerProtocolMessagePort, type RpcServerPort } from "@ivin/state/rpc-server-protocol"
import { listenOnUnixSocket } from "../shared/adapters/unix-socket.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { handlers } from "./handlers.ts"

const serveGroupOverPort = <R extends Rpc.Any>(
  group: RpcGroup.RpcGroup<R>,
  port: RpcServerPort,
  info: ServerInfo["Service"],
) =>
  RpcServer.layer(group, { disableFatalDefects: true }).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.succeed(ServerInfo)(info)),
    Layer.provide(layerProtocolMessagePort(port)),
  )

export const serveOverPort = (port: RpcServerPort, info: ServerInfo["Service"]) =>
  serveGroupOverPort(Rpcs, port, info)

// Each connection is one more client of the same handlers, limited to the CLI's RPCs.
export const serveOverSocket = (path: string, info: ServerInfo["Service"]) =>
  listenOnUnixSocket(path, (port) => Layer.launch(serveGroupOverPort(CliSocketRpcs, port, info)))

export interface ClosablePort extends RpcServerPort {
  readonly onClose: (handler: () => void) => void
}

export const serveOverClosingPort = (port: ClosablePort, info: ServerInfo["Service"]) =>
  Effect.raceFirst(
    Layer.launch(serveOverPort(port, info)),
    Effect.callback<void>((resume) => port.onClose(() => resume(Effect.void))),
  )
