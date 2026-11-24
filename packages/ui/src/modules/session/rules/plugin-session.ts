import type { Session } from "@ivin/contracts/session"
import type { Session as PluginSession } from "@ivin/plugin-api/ui"

// The host is the only source of a plugin's session, so it holds the contract's own Session.
export const contractSession = (session: PluginSession) => session as unknown as Session
