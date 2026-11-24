import type { Session } from "@ivin/contracts/session"
import type { Session as PluginSession } from "@ivin/plugin-api/ui"

export const contractSession = (session: PluginSession) => session as unknown as Session
