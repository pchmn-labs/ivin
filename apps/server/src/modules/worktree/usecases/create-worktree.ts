import { Data, Effect } from "effect"
import { generatedBranch, worktreePath } from "../rules/worktree-branch.ts"
import { worktreeBase } from "../rules/worktree-base.ts"
import { Git } from "./git.ts"
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
    const branch = generatedBranch(sessionId)
    const path = worktreePath(repo, branch)
    const hasOrigin = yield* git.hasRemote(repo, "origin")
    if (hasOrigin) yield* origin.fetch(repo)
    const base = worktreeBase({
      hasOrigin,
      originHead: hasOrigin ? yield* git.originHead(repo) : null,
      remote: hasOrigin ? (yield* git.listBranches(repo)).remote : [],
    })
    if (base === null) return yield* new NoDefaultBranch()
    yield* git.createWorktree(repo, { path, branch, base })
    return { path, branch, worktreesIgnored: yield* git.isIgnored(repo, path) }
  })
