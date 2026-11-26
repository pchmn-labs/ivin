import { Effect } from "effect"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { WorkingFolderRoot } from "../../project/usecases/working-folder-root.ts"
import { workspaceName } from "../../project/rules/workspace-file.ts"
import { WORKTREE_FETCH_REUSE_MS } from "../rules/fetch-reuse.ts"
import {
  freeWorkspaceBranch,
  subfolderNames,
  workingFolderPath,
} from "../rules/workspace-folder.ts"
import { GitError, Git } from "./git.ts"
import { NoDefaultBranch } from "./create-worktree.ts"
import { newWorktreeBase } from "./new-worktree-base.ts"
import { OriginFetch } from "./origin-fetch.ts"
import { WorkingFolders } from "./working-folders.ts"

// One worktree per project folder that is a git repository, all on one branch, in a new folder
// of ivin's own. Nothing is left behind when one of them fails.
export const createWorkspaceWorkingFolder = (workspace: string, sessionId: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const origin = yield* OriginFetch
    const files = yield* WorkingFolders
    const folders = (yield* (yield* ProjectStore).folders(workspace)) ?? []
    const repositories: string[] = []
    for (const folder of folders)
      if ((yield* git.gitDir(folder)) !== null) repositories.push(folder)
    if (repositories.length === 0) {
      return yield* new GitError({
        message: "None of the workspace's folders is a git repository.",
      })
    }
    const names = subfolderNames(repositories)
    const root = (yield* WorkingFolderRoot).path
    const name = workspaceName(workspace)

    const taken = new Set<string>()
    for (const repository of repositories) {
      for (const branch of (yield* git.listBranches(repository)).local) taken.add(branch)
    }
    const occupied = new Set<string>(taken)
    let branch = freeWorkspaceBranch(sessionId, (candidate) => occupied.has(candidate))
    while (yield* files.exists(workingFolderPath(root, name, branch))) {
      occupied.add(branch)
      branch = freeWorkspaceBranch(sessionId, (candidate) => occupied.has(candidate))
    }
    const path = workingFolderPath(root, name, branch)

    const bases: string[] = []
    for (const repository of repositories) {
      if (yield* git.hasRemote(repository, "origin")) {
        yield* origin.fetch(repository, { reuseMs: WORKTREE_FETCH_REUSE_MS, afterFailure: "retry" })
      }
      const base = yield* newWorktreeBase(repository)
      if (base === null) return yield* new NoDefaultBranch()
      bases.push(base)
    }

    const created: Array<{ repository: string; path: string }> = []
    const undo = Effect.gen(function* () {
      for (const done of created)
        yield* git.removeWorktree(done.repository, done.path).pipe(Effect.ignore)
      yield* files.remove(path)
    })
    // Also on interruption and on a defect, not only on a git error.
    yield* Effect.gen(function* () {
      for (const [index, repository] of repositories.entries()) {
        const worktree = `${path}/${names[index]}`
        yield* git.createWorktree(repository, { path: worktree, branch, base: bases[index]! })
        created.push({ repository, path: worktree })
      }
    }).pipe(Effect.onError(() => undo))
    return { path, branch }
  })
