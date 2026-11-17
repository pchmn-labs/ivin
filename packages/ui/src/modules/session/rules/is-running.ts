import type { SessionStatus } from "@ivin/contracts/session"

export const isRunning = (status: SessionStatus | undefined) =>
  status === "working" || status === "waiting"
