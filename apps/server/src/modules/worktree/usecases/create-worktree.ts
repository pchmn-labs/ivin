import { Data, Effect } from "effect"
import { WORKTREE_FETCH_REUSE_MS } from "../rules/fetch-reuse.ts"
import { freeGeneratedBranch, worktreePath } from "../rules/worktree-branch.ts"
import { Git } from "./git.ts"
import { newWorktreeBase } from "./new-worktree-base.ts"
import { OriginFetch } from "./origin-fetch.ts"

export class NoDefaultBranch extends Data.TaggedError("NoDefaultBranch")<{}> {
  override get message() {
    return "origin has no HEAD, origin/main or origin/master to start the worktree from"
  }
}

export const createWorktree = (repo: string, sessionId: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const origin = yield* OriginFetch
    // A session that already had a worktree may have left its branch, or a deleted folder git still lists.
    const branch = freeGeneratedBranch(repo, sessionId, {
      branches: (yield* git.listBranches(repo)).local,
      paths: (yield* git.listWorktrees(repo)).map((entry) => entry.path),
    })
    const path = worktreePath(repo, branch)
    if (yield* git.hasRemote(repo, "origin"))
      yield* origin.fetch(repo, { reuseMs: WORKTREE_FETCH_REUSE_MS, afterFailure: "retry" })
    const base = yield* newWorktreeBase(repo)
    if (base === null) return yield* new NoDefaultBranch()
    yield* git.createWorktree(repo, { path, branch, base })
    return { path, branch, worktreesIgnored: yield* git.isIgnored(repo, path) }
  })
