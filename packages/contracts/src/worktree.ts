import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Worktree = Schema.Struct({
  path: Schema.String,
  // Null on a detached HEAD.
  branch: Schema.NullOr(Schema.String),
})
export type Worktree = typeof Worktree.Type

export const WorktreeRpcs = RpcGroup.make(
  // The project's linked worktrees, without its checkout; none outside a git repository.
  Rpc.make("worktree.list", {
    payload: { projectPath: Schema.String },
    success: Schema.Array(Worktree),
  }),
)
