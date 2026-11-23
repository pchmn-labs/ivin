import type { SessionStatus } from "@ivin/contracts/session"

const LABELS: Record<SessionStatus, string> = {
  preparing_worktree: "Preparing worktree…",
  working: "Working",
  waiting: "Waiting for you",
  in_background: "In background",
  idle: "Idle",
  failed: "Failed",
}

export const statusLabel = (status: SessionStatus) => LABELS[status]
