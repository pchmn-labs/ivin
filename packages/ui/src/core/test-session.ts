import { DateTime } from "effect"
import type { Session } from "@ivin/contracts/session"

// For tests outside this package, such as plugins', which cannot import effect.
export const makeTestSession = (
  session: Pick<Session, "id" | "title"> & Partial<Session>,
): Session => ({
  projectPath: "/p",
  workingFolder: session.projectPath ?? "/p",
  inWorktree: false,
  branch: "main",
  started: true,
  model: "sonnet",
  status: "idle",
  createdAt: DateTime.makeUnsafe(0),
  lastActivityAt: DateTime.makeUnsafe(0),
  ...session,
})
