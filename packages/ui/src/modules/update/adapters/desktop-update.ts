import "../../../core/desktop-bridge.ts"
import type { UpdateState } from "@ivin/contracts/update"

export const getUpdateState = (): Promise<UpdateState> => window.ivin.getUpdateState()

export const onUpdateState = (listener: (state: UpdateState) => void): (() => void) =>
  window.ivin.onUpdateState(listener)

export const checkForUpdates = (): Promise<UpdateState> => window.ivin.checkForUpdates()

export const restartToUpdate = (): Promise<void> => window.ivin.restartToUpdate()
