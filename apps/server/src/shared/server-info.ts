import { Context } from "effect"

export class ServerInfo extends Context.Service<ServerInfo, { readonly version: string }>()(
  "ivin/server/ServerInfo",
) {}
