import { GitFailed } from "@ivin/contracts/file"
import type { GitError } from "../../worktree/usecases/git.ts"

export const gitFailed =
  (sessionId: string) =>
  ({ message }: GitError) =>
    new GitFailed({ sessionId, gitMessage: message })
