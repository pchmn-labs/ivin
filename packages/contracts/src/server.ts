import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { Harness } from "./session.ts"

export const ServerVersion = Schema.Struct({ version: Schema.String })
export type ServerVersion = typeof ServerVersion.Type

export const ServerRpcs = RpcGroup.make(
  Rpc.make("server.getVersion", { success: ServerVersion }),
  // The harness the server runs, which every session it creates runs on.
  Rpc.make("server.getHarness", { success: Harness }),
)
