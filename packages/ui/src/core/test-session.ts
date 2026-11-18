import { DateTime } from "effect"
import type { Session } from "@ivin/contracts/session"

// For tests outside this package, such as plugins', which cannot import effect.
export const testDateTime = (epochMillis: number) => DateTime.makeUnsafe(epochMillis)

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
  statusChangedAt: DateTime.makeUnsafe(0),
  createdAt: DateTime.makeUnsafe(0),
  lastActivityAt: DateTime.makeUnsafe(0),
  ...session,
})
