import { type Worktree, WorktreeGitFailed } from "@ivin/contracts/worktree"
import { Effect } from "effect"
import { isWorkspaceFile, workspaceName } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { WorkingFolderRoot } from "../../project/usecases/working-folder-root.ts"
import { linkedWorktrees } from "../rules/linked-worktrees.ts"
import {
  type WorkingFolderWorktree,
  workingFoldersOf,
  workspaceFolderPath,
} from "../rules/workspace-folder.ts"
import { Git } from "./git.ts"

const linkedWorktreesOf = (repository: string) =>
  Effect.gen(function* () {
    const entries = yield* (yield* Git)
      .listWorktrees(repository)
      .pipe(
        Effect.mapError(
          ({ message }) => new WorktreeGitFailed({ projectPath: repository, gitMessage: message }),
        ),
      )
    return linkedWorktrees(repository, entries)
  })

// The working folder is no repository, so each project folder that is one is asked.
export const workspaceWorkingFolders = (workspace: string) =>
  Effect.gen(function* () {
    const git = yield* Git
    const folders = (yield* (yield* ProjectStore).folders(workspace)) ?? []
    const worktrees: WorkingFolderWorktree[] = []
    for (const repository of folders) {
      if ((yield* git.gitDir(repository)) === null) continue
      for (const worktree of yield* linkedWorktreesOf(repository))
        worktrees.push({ repository, ...worktree })
    }
    const root = (yield* WorkingFolderRoot).path
    return workingFoldersOf(workspaceFolderPath(root, workspaceName(workspace)), worktrees)
  })

export const listWorktrees = (projectPath: string) =>
  isWorkspaceFile(projectPath)
    ? workspaceWorkingFolders(projectPath).pipe(
        Effect.map((found) =>
          found.map((folder): Worktree => ({
            path: folder.path,
            branch: folder.branch,
            repositories: folder.worktrees.map((w) => ({
              name: w.path.slice(w.path.lastIndexOf("/") + 1),
              branch: w.branch,
            })),
          })),
        ),
      )
    : linkedWorktreesOf(projectPath)

const orNone =
  (projectPath: string) =>
  <A, R>(listing: Effect.Effect<readonly A[], WorktreeGitFailed, R>) =>
    listing.pipe(
      Effect.catch((error) =>
        Effect.logWarning(`could not list the worktrees of ${projectPath}`, error).pipe(
          Effect.as([] as readonly A[]),
        ),
      ),
    )

// For callers that act on the list rather than show it: a failure means nothing to act on.
export const listWorktreesOrNone = (projectPath: string) =>
  listWorktrees(projectPath).pipe(orNone(projectPath))

// The same for a project that is no workspace.
export const listCheckoutWorktreesOrNone = (projectPath: string) =>
  linkedWorktreesOf(projectPath).pipe(orNone(projectPath))
