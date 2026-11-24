import type { SessionStatus } from "@ivin/contracts/session"

export const isRunning = (status: SessionStatus | undefined) =>
  status === "working" || status === "waiting"

// A turn runs, or tasks the agent started do: stopping the agent ends them.
export const isAgentBusy = (status: SessionStatus | undefined) =>
  isRunning(status) || status === "in_background"
