import type { Change, GitStatusEntry } from "@ivin/contracts/file"
import { SessionNotFound, type Session, WorkingFolderDeleted } from "@ivin/contracts/session"
import { Effect } from "effect"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { awaitsWorkspaceFolder } from "../../session/rules/workspace-start.ts"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { subfolderNames } from "../../worktree/rules/workspace-folder.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { FolderReader } from "./folder-reader.ts"

export interface Repository {
  readonly name: string
  readonly folder: string
}

const nameOf = (folder: string) => folder.slice(folder.lastIndexOf("/") + 1)

export const projectFoldersOf = (session: Session) =>
  Effect.gen(function* () {
    if (!awaitsWorkspaceFolder(session)) return null
    const folders = (yield* (yield* ProjectStore).folders(session.projectPath)) ?? []
    const names = subfolderNames(folders)
    return folders.map((folder, index): Repository => ({ name: names[index]!, folder }))
  })

// Null when the first name is no project folder of a session that shows them.
export const folderOfNames = (session: Session, names: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const reader = yield* FolderReader
    const projectFolders = yield* projectFoldersOf(session)
    if (projectFolders === null) {
      const root = yield* reader.realPath(session.workingFolder)
      if (root === null) return yield* new WorkingFolderDeleted({ sessionId: session.id })
      return { root, names }
    }
    const folder = projectFolders.find((candidate) => candidate.name === names[0])
    const root = folder === undefined ? null : yield* reader.realPath(folder.folder)
    return root === null ? null : { root, names: names.slice(1) }
  })

// The repositories of a working folder that is none itself, as on a workspace: the subfolders of
// a folder of worktrees, or the project folders. Null for any other session.
export const repositoriesIn = (session: Session, root: string) =>
  Effect.gen(function* () {
    if (!isWorkspaceFile(session.projectPath)) return null
    const git = yield* Git
    const projectFolders = yield* projectFoldersOf(session)
    if (projectFolders !== null) {
      const found: Repository[] = []
      for (const folder of projectFolders) {
        if ((yield* git.gitDir(folder.folder)) !== null) found.push(folder)
      }
      return found
    }
    if ((yield* git.gitDir(root)) !== null) return null
    // A session started in the project folders' common parent before ADR-0018's default keeps it.
    const candidates = session.inWorktree
      ? (yield* (yield* FolderReader).readEntries(root).pipe(Effect.orElseSucceed(() => [])))
          .filter((entry) => entry.kind === "folder")
          .map((entry) => `${root}/${entry.name}`)
      : ((yield* (yield* ProjectStore).folders(session.projectPath)) ?? []).filter(
          (folder) => folder.slice(0, folder.lastIndexOf("/")) === root,
        )
    const found: Repository[] = []
    for (const folder of candidates) {
      if ((yield* git.gitDir(folder)) !== null) found.push({ name: nameOf(folder), folder })
    }
    return found
  })

export const sessionRoot = (sessionId: string) =>
  Effect.gen(function* () {
    const session = yield* (yield* SessionStore).findById(sessionId)
    if (session === null) return yield* new SessionNotFound({ sessionId })
    const root = yield* (yield* FolderReader).realPath(session.workingFolder)
    if (root === null) return yield* new WorkingFolderDeleted({ sessionId })
    return { session, root, repositories: yield* repositoriesIn(session, root) }
  })

export const prefixed = (repository: Repository, path: string) => `${repository.name}/${path}`

export const prefixChange = (repository: Repository, change: Change): Change => ({
  ...change,
  path: prefixed(repository, change.path),
  previousPath: change.previousPath === null ? null : prefixed(repository, change.previousPath),
})

export const prefixStatus = (repository: Repository, entry: GitStatusEntry): GitStatusEntry => ({
  ...entry,
  path: prefixed(repository, entry.path),
})

export const repositoryOfPath = (repositories: readonly Repository[], path: string) => {
  const slash = path.indexOf("/")
  if (slash === -1) return null
  const repository = repositories.find((candidate) => candidate.name === path.slice(0, slash))
  return repository === undefined ? null : { repository, path: path.slice(slash + 1) }
}
