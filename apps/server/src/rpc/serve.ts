import { ServerRpcs } from "@ivin/contracts/server"
import { Layer } from "effect"
import { RpcServer } from "effect/rpc"
import { layerProtocolMessagePort, type RpcPort } from "../shared/message-port-protocol.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { handlers } from "./handlers.ts"

export const serveOverPort = (port: RpcPort, info: ServerInfo["Service"]) =>
  RpcServer.layer(ServerRpcs).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.succeed(ServerInfo)(info)),
    Layer.provide(layerProtocolMessagePort(port)),
  )
