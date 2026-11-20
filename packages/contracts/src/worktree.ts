import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Worktree = Schema.Struct({
  path: Schema.String,
  // Null on a detached HEAD.
  branch: Schema.NullOr(Schema.String),
})
export type Worktree = typeof Worktree.Type

export const CheckoutStatus = Schema.Struct({
  // Null on a detached HEAD.
  branch: Schema.NullOr(Schema.String),
  // Null without origin or when origin has no default branch.
  defaultBranch: Schema.NullOr(Schema.String),
  // Git refuses to check out a branch another worktree holds.
  defaultBranchInWorktree: Schema.Boolean,
  // Commits the branch can fast-forward from `origin/<branch>`; 0 when the two diverged.
  behind: Schema.Number,
})
export type CheckoutStatus = typeof CheckoutStatus.Type
export const Branch = Schema.Struct({
  // `origin/<name>` for a remote branch.
  name: Schema.String,
  remote: Schema.Boolean,
  // The checkout or worktree that has it checked out, null when none does.
  worktreePath: Schema.NullOr(Schema.String),
})
export type Branch = typeof Branch.Type

export const BranchList = Schema.Struct({
  branches: Schema.Array(Branch),
  // `fetching`: origin is being fetched and another list follows.
  fetch: Schema.Literals(["fetching", "done", "failed"]),
})
export type BranchList = typeof BranchList.Type

export const WorktreeRpcs = RpcGroup.make(
  // The project's linked worktrees, without its checkout; none outside a git repository.
  Rpc.make("worktree.list", {
    payload: { projectPath: Schema.String },
    success: Schema.Array(Worktree),
  }),
  // What a new worktree starts from, from the refs as last fetched: `origin/<name>`, or `HEAD`
  // without an origin. Null when origin has no default branch or outside a git repository.
  Rpc.make("worktree.newBase", {
    payload: { projectPath: Schema.String },
    success: Schema.NullOr(Schema.String),
  }),
  // Fetches origin first, reusing a fetch younger than two minutes. Null outside a git repository.
  Rpc.make("worktree.checkoutStatus", {
    payload: { projectPath: Schema.String },
    success: Schema.NullOr(CheckoutStatus),
  }),
  // The project's local and origin's branches as they are, then again once origin is fetched,
  // which happens at most once a minute. Empty outside a git repository.
  Rpc.make("worktree.listBranches", {
    payload: { projectPath: Schema.String },
    success: BranchList,
    stream: true,
  }),
)
