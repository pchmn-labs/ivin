import { ServerRpcs } from "@ivin/contracts/server"
import { getVersion } from "../modules/server/usecases/get-version.ts"

export const handlers = ServerRpcs.toLayer({
  "server.getVersion": () => getVersion,
})
