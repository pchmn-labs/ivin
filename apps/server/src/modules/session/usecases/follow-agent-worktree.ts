import type { Session } from "@ivin/contracts/session"
import type { HarnessEvent, HarnessOutput } from "@ivin/contracts/transcript"
import type { Worktree } from "@ivin/contracts/worktree"
import type { ToolActivity, ToolOutcome, ToolUse } from "@ivin/harness"
import { Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { listWorktreesOrNone } from "../../worktree/usecases/list-worktrees.ts"
import { folderAfterTool, folderMovedTo, needsWorktreeList } from "../rules/agent-worktree.ts"
import { SessionStore } from "./session-store.ts"

export const followAgentWorktree = (
  session: Session,
  record: (event: HarnessEvent) => Effect.Effect<void>,
  toolActivity: (call: ToolUse, result: ToolOutcome) => ToolActivity,
) =>
  Effect.gen(function* () {
    const git = yield* Git
    const store = yield* SessionStore
    const known = new Set<string>()
    const created = new Set<string>()
    const calls = new Map<string, ToolUse>()
    let worktrees: readonly Worktree[] = []

    const refreshWorktrees = listWorktreesOrNone(session.projectPath).pipe(
      Effect.provideService(Git, git),
      Effect.tap((listed) => Effect.sync(() => void (worktrees = listed))),
    )

    const turnStarted = refreshWorktrees.pipe(
      Effect.tap((listed) => Effect.sync(() => listed.forEach((w) => known.add(w.path)))),
      Effect.asVoid,
    )

    const moveTo = (path: string) =>
      Effect.gen(function* () {
        const inWorktree = path !== session.projectPath
        const branch = inWorktree
          ? (worktrees.find((w) => w.path === path)?.branch ?? null)
          : yield* git.currentBranch(path)
        created.delete(path)
        yield* store.setWorkingFolder(session.id, path, branch)
        yield* record({
          type: "working_folder",
          path,
          inWorktree,
          branch,
          cause: "adoption",
          // The warning is for the worktrees ivin creates under .worktrees/.
          worktreesIgnored: true,
          raw: null,
        })
      })

    // From the checkout, any listed worktree can be the agent's: it may have made it in an earlier run.
    const candidates = (workingFolder: string, listed: ReadonlySet<string>) =>
      [...(workingFolder === session.projectPath ? listed : created)].filter(
        (path) => path !== session.projectPath && listed.has(path),
      )

    const observe = (output: HarnessOutput) =>
      Effect.gen(function* () {
        if (output.type === "tool_call") {
          calls.set(output.toolCallId, { name: output.name, input: output.input })
          return
        }
        if (output.type !== "tool_result") return
        const call = calls.get(output.toolCallId)
        calls.delete(output.toolCallId)
        if (!call || output.isError) return
        const activity = toolActivity(call, output)
        const appeared: string[] = []
        if (needsWorktreeList(activity)) {
          for (const worktree of yield* refreshWorktrees) {
            if (!known.has(worktree.path)) {
              created.add(worktree.path)
              appeared.push(worktree.path)
            }
            known.add(worktree.path)
          }
        }
        const current = yield* store.findById(session.id)
        if (!current) return
        const listed = new Set(worktrees.map((w) => w.path))
        const movedTo = folderMovedTo({
          workingFolder: current.workingFolder,
          projectPath: session.projectPath,
          listed,
          appeared,
        })
        const target =
          movedTo ??
          folderAfterTool({
            activity,
            workingFolder: current.workingFolder,
            folders: [session.projectPath, ...listed],
            created: candidates(current.workingFolder, listed),
          })
        if (target) yield* moveTo(target)
      })

    return { turnStarted, observe }
  })
