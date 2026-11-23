import { CliSocketRpcs, Rpcs } from "@ivin/contracts/rpcs"
import { Layer } from "effect"
import { RpcServer } from "effect/rpc"
import { layerProtocolMessagePort, type RpcPort } from "../shared/message-port-protocol.ts"
import { listenOnUnixSocket } from "../shared/adapters/unix-socket.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { handlers } from "./handlers.ts"

export const serveOverPort = (port: RpcPort, info: ServerInfo["Service"]) =>
  RpcServer.layer(Rpcs).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.succeed(ServerInfo)(info)),
    Layer.provide(layerProtocolMessagePort(port)),
  )

// Each connection is one more client of the same handlers, limited to the CLI's RPCs.
export const serveOverSocket = (path: string, info: ServerInfo["Service"]) =>
  listenOnUnixSocket(path, (port) =>
    Layer.launch(
      RpcServer.layer(CliSocketRpcs).pipe(
        Layer.provide(handlers),
        Layer.provide(Layer.succeed(ServerInfo)(info)),
        Layer.provide(layerProtocolMessagePort(port)),
      ),
    ),
  )
