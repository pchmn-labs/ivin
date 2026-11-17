import { ProjectRpcs } from "./project.ts"
import { ServerRpcs } from "./server.ts"

export const Rpcs = ServerRpcs.merge(ProjectRpcs)
