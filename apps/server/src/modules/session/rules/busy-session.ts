import type { Session } from "@ivin/contracts/session"

const BUSY = new Set<Session["status"]>([
  "preparing_worktree",
  "working",
  "waiting",
  "in_background",
])

export const isBusy = (session: Pick<Session, "status">) => BUSY.has(session.status)
