import type { Session } from "@ivin/contracts/session"
import { Effect } from "effect"
import { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { isWorkspaceFile, workspaceName } from "../../project/rules/workspace-file.ts"
import { WorkingFolderRoot } from "../../project/usecases/working-folder-root.ts"
import { workspaceFolderPath } from "../../worktree/rules/workspace-folder.ts"
import {
  isInUse,
  isRemovable,
  removalCandidates,
  workingFolderState,
  type WorktreeState,
} from "../../worktree/rules/worktree-removal.ts"
import { Git } from "../../worktree/usecases/git.ts"
import {
  listWorktreesOrNone,
  workspaceWorkingFolders,
} from "../../worktree/usecases/list-worktrees.ts"
import { newWorktreeBase } from "../../worktree/usecases/new-worktree-base.ts"
import { OriginFetch } from "../../worktree/usecases/origin-fetch.ts"
import { WorkingFolders } from "../../worktree/usecases/working-folders.ts"
import { checkWorkingFolders } from "./check-working-folder.ts"
import { SessionRuns } from "./session-runs.ts"
import { sessionProjectFolder } from "./session-project-folder.ts"
import { SessionStore } from "./session-store.ts"
import { SessionTabs } from "./session-tabs.ts"

const fetchOrigin = (repository: string) =>
  Effect.gen(function* () {
    // A pull request merged since the last fetch must count as merged.
    yield* (yield* OriginFetch)
      .fetch(repository, { reuseMs: 0, afterFailure: "retry" })
      .pipe(Effect.catch((error) => Effect.logWarning(`could not fetch ${repository}`, error)))
  })

const sessionUses = (
  projectPath: string,
  closedSessionIds: readonly string[],
  deletedSessions: readonly Session[],
) =>
  Effect.gen(function* () {
    const sessions = [
      ...(yield* (yield* SessionStore).listByProject(projectPath)),
      ...deletedSessions,
    ]
    const open = new Set(yield* (yield* SessionTabs).openSessionIds(projectPath))
    const runs = yield* SessionRuns
    const closed = new Set(closedSessionIds)
    return yield* Effect.forEach(sessions, (session) =>
      runs.isRunning(session.id).pipe(
        Effect.map((running) => ({
          ...session,
          tabJustClosed: closed.has(session.id),
          inUse: running || open.has(session.id),
        })),
      ),
    )
  })

// Run once the closed sessions' agents have stopped: a running agent keeps its worktree.
// `deletedSessions` are gone from the store, yet their worktrees count as just closed.
export const removeMergedWorktrees = (
  projectPath: string,
  closedSessionIds: readonly string[],
  deletedSessions: readonly Session[] = [],
) =>
  Effect.gen(function* () {
    const { worktrees } = yield* (yield* CurrentSettings).get
    if (!worktrees.removeOnTabClose) return
    const uses = sessionUses(projectPath, closedSessionIds, deletedSessions)
    const sessions = isWorkspaceFile(projectPath)
      ? yield* removeMergedWorkspaceWorktrees(projectPath, uses)
      : yield* removeMergedCheckoutWorktrees(projectPath, uses, `${projectPath}/.worktrees`)
    if (sessions === null) return
    const deleted = new Set(deletedSessions.map((session) => session.id))
    yield* checkWorkingFolders(
      projectPath,
      sessions.filter((session) => !deleted.has(session.id)),
    )
  })

type SessionUses = ReturnType<typeof sessionUses>

const removeMergedCheckoutWorktrees = (
  projectPath: string,
  uses: SessionUses,
  sweptFolder: string | null,
) =>
  Effect.gen(function* () {
    const git = yield* Git
    if (!(yield* git.hasRemote(projectPath, "origin"))) return null
    yield* fetchOrigin(projectPath)
    const target = yield* newWorktreeBase(projectPath)
    if (target === null) return null

    const sessions = yield* uses
    const candidates = removalCandidates(
      projectPath,
      yield* listWorktreesOrNone(projectPath),
      sessions,
      sweptFolder,
    )

    yield* Effect.forEach(candidates, ({ path, origin }) =>
      Effect.gen(function* () {
        const clean = yield* git.isClean(path)
        const state = { clean, ...(yield* git.isMergedInto(path, target)) }
        if (!isRemovable(origin, state)) return
        // A tab may have reopened, or an agent started, while git answered.
        if (isInUse(path, yield* uses)) return
        yield* git.removeWorktree(projectPath, path)
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`could not clean up the worktree ${path}`, error),
        ),
      ),
    )
    return sessions
  })

// The worktrees of one project folder a closed session was in, then the working folders. The project
// folders are not swept: their `.worktrees/` may hold another project's sessions.
const removeMergedWorkspaceWorktrees = (workspace: string, uses: SessionUses) =>
  Effect.gen(function* () {
    const closed = (yield* uses).filter((s) => s.tabJustClosed && s.inWorktree)
    const folders = new Set<string>()
    for (const session of closed) {
      const folder = yield* sessionProjectFolder(session)
      if (folder !== null) folders.add(folder)
    }
    for (const folder of folders) yield* removeMergedCheckoutWorktrees(folder, uses, null)
    return yield* removeMergedWorkingFolders(workspace, uses)
  })

// A working folder goes only once each of its worktrees could go, and it holds nothing else.
const removeMergedWorkingFolders = (workspace: string, uses: SessionUses) =>
  Effect.gen(function* () {
    const git = yield* Git
    const files = yield* WorkingFolders
    const folders = yield* workspaceWorkingFolders(workspace).pipe(
      Effect.catch((error) =>
        Effect.logWarning(`could not list the working folders of ${workspace}`, error).pipe(
          Effect.as([]),
        ),
      ),
    )
    const repositories = new Set(
      folders.flatMap((folder) => folder.worktrees.map((w) => w.repository)),
    )
    // Without a target, a repository's worktrees cannot be judged merged.
    const targets = new Map<string, string | null>()
    for (const repository of repositories) {
      if (!(yield* git.hasRemote(repository, "origin").pipe(Effect.orElseSucceed(() => false)))) {
        targets.set(repository, null)
        continue
      }
      yield* fetchOrigin(repository)
      targets.set(
        repository,
        yield* newWorktreeBase(repository).pipe(Effect.orElseSucceed(() => null)),
      )
    }

    const sessions = yield* uses
    const candidates = removalCandidates(
      workspace,
      folders.map((folder) => ({
        path: folder.path,
        // Any detached worktree keeps the folder; the branches need not be the same.
        branch: folder.worktrees.some((w) => w.branch === null) ? null : folder.path,
      })),
      sessions,
      workspaceFolderPath((yield* WorkingFolderRoot).path, workspaceName(workspace)),
    )

    yield* Effect.forEach(candidates, ({ path, origin }) =>
      Effect.gen(function* () {
        const folder = folders.find((f) => f.path === path)!
        const names = new Set(folder.worktrees.map((w) => w.path.slice(path.length + 1)))
        if ((yield* files.entries(path)).some((name) => !names.has(name))) return
        const states: WorktreeState[] = []
        for (const worktree of folder.worktrees) {
          const target = targets.get(worktree.repository)
          if (!target) return
          const clean = yield* git.isClean(worktree.path)
          states.push({ clean, ...(yield* git.isMergedInto(worktree.path, target)) })
        }
        if (!isRemovable(origin, workingFolderState(states))) return
        if (isInUse(path, yield* uses)) return
        for (const worktree of folder.worktrees)
          yield* git.removeWorktree(worktree.repository, worktree.path)
        yield* files.remove(path)
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning(`could not clean up the working folder ${path}`, error),
        ),
      ),
    )
    return sessions
  })
