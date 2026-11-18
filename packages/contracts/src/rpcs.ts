import { LogRpcs } from "./log.ts"
import { ProjectRpcs } from "./project.ts"
import { ServerRpcs } from "./server.ts"
import { SessionRpcs } from "./session.ts"
import { TabRpcs } from "./tab.ts"
import { TranscriptRpcs } from "./transcript.ts"

export const Rpcs = ServerRpcs.merge(LogRpcs, ProjectRpcs, SessionRpcs, TabRpcs, TranscriptRpcs)
