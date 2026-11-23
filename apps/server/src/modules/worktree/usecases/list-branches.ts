import { type BranchList, WorktreeGitFailed } from "@ivin/contracts/worktree"
import { Effect, Stream } from "effect"
import { logError } from "../../log/usecases/log-error.ts"
import { branchList } from "../rules/branch-list.ts"
import { BRANCH_LIST_FETCH_REUSE_MS } from "../rules/fetch-reuse.ts"
import { Git } from "./git.ts"
import { OriginFetch } from "./origin-fetch.ts"

export const listBranches = (
  projectPath: string,
): Stream.Stream<BranchList, WorktreeGitFailed, Git | OriginFetch> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const git = yield* Git
      const origin = yield* OriginFetch
      const read = (fetch: BranchList["fetch"]) =>
        Effect.all([git.listBranches(projectPath), git.listWorktrees(projectPath)]).pipe(
          Effect.map(([branches, worktrees]) => ({
            branches: branchList(branches, worktrees),
            fetch,
          })),
          Effect.mapError(
            ({ message }) => new WorktreeGitFailed({ projectPath, gitMessage: message }),
          ),
        )
      const hasOrigin = yield* git
        .hasRemote(projectPath, "origin")
        .pipe(Effect.orElseSucceed(() => false))
      if (!hasOrigin) return Stream.fromEffect(read("done"))
      const fetched = origin
        .fetch(projectPath, { reuseMs: BRANCH_LIST_FETCH_REUSE_MS, afterFailure: "wait" })
        .pipe(
          Effect.as("done" as const),
          Effect.catch((error) =>
            logError("fetch origin", error).pipe(Effect.as("failed" as const)),
          ),
          Effect.flatMap(read),
        )
      return Stream.fromEffect(read("fetching")).pipe(Stream.concat(Stream.fromEffect(fetched)))
    }),
  )
