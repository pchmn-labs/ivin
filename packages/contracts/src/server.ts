import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const ServerVersion = Schema.Struct({ version: Schema.String })
export type ServerVersion = typeof ServerVersion.Type

export const ServerRpcs = RpcGroup.make(Rpc.make("server.getVersion", { success: ServerVersion }))
