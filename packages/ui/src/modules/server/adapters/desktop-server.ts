import "../../../core/desktop-bridge.ts"
import type { ServerState } from "../../../core/desktop-bridge.ts"

export const getServerState = (): Promise<ServerState> => window.ivin.getServerState()

export const onServerState = (listener: (state: ServerState) => void): (() => void) =>
  window.ivin.onServerState(listener)

export const restartServer = (): Promise<void> => window.ivin.restartServer()
