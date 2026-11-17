import { ServerRpcs } from "@ivin/contracts/server"
import { getVersion } from "./server-get-version.ts"

export const handlers = ServerRpcs.toLayer({
  "server.getVersion": () => getVersion,
})
