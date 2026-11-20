import { Effect, Layer } from "effect"
import { execFile } from "node:child_process"
import { realpathSync } from "node:fs"
import {
  parseBranches,
  parseDivergence,
  parseWorktreeList,
  underOpenedPath,
} from "../rules/git-output.ts"
import { Git, GitError } from "../usecases/git.ts"

interface ExecFailure {
  readonly stderr?: string
  readonly message?: string
}

const git = (cwd: string, args: readonly string[]) =>
  Effect.callback<string, GitError>((resume, signal) => {
    execFile(
      "git",
      args,
      // A fetch must never wait on a credential prompt nobody can answer.
      { cwd, signal, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 16 << 20 },
      (error, stdout) => {
        if (!error) return resume(Effect.succeed(stdout))
        const failure = error as ExecFailure
        const message = failure.stderr?.trim() || failure.message || "git failed"
        resume(Effect.fail(new GitError({ message })))
      },
    )
  })

const orNull = <A>(effect: Effect.Effect<A, GitError>) =>
  effect.pipe(Effect.orElseSucceed(() => null))

export const layerGitCli = Layer.succeed(Git)({
  listWorktrees: (repo) =>
    git(repo, ["worktree", "list", "--porcelain"]).pipe(
      Effect.map((out) => underOpenedPath(parseWorktreeList(out), repo, realpathSync(repo))),
    ),
  listBranches: (repo) =>
    git(repo, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"]).pipe(
      Effect.map(parseBranches),
    ),
  hasRemote: (repo, remote) =>
    git(repo, ["remote"]).pipe(Effect.map((out) => out.split("\n").includes(remote))),
  originHead: (repo) =>
    orNull(git(repo, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])).pipe(
      Effect.map((out) => out?.trim() || null),
    ),
  fetch: (repo, remote) => git(repo, ["fetch", "--quiet", remote]).pipe(Effect.asVoid),
  createWorktree: (repo, { path, branch, base }) =>
    // `--no-track`: a push must never go to the default branch the worktree started from.
    git(repo, ["worktree", "add", "--no-track", "-b", branch, path, base]).pipe(Effect.asVoid),
  checkout: (folder, branch) =>
    git(folder, ["checkout", "--quiet", branch, "--"]).pipe(Effect.asVoid),
  checkoutTracking: (folder, remote, branch) =>
    git(folder, ["checkout", "--quiet", "--track", "-b", branch, remote, "--"]).pipe(Effect.asVoid),
  currentBranch: (folder) =>
    orNull(git(folder, ["symbolic-ref", "--quiet", "--short", "HEAD"])).pipe(
      Effect.map((out) => out?.trim() || null),
    ),
  hasLocalChanges: (folder) =>
    git(folder, ["status", "--porcelain", "--untracked-files=no"]).pipe(
      Effect.map((out) => out.trim() !== ""),
    ),
  stash: (folder, message) =>
    git(folder, ["stash", "push", "--include-untracked", "-m", message]).pipe(Effect.asVoid),
  commitTracked: (folder, message) =>
    git(folder, ["commit", "--quiet", "--all", "-m", message]).pipe(Effect.asVoid),
  fastForward: (folder, upstream) =>
    git(folder, ["merge", "--ff-only", "--quiet", upstream]).pipe(Effect.asVoid),
  divergence: (folder, branch, upstream) =>
    git(folder, ["rev-list", "--left-right", "--count", `${branch}...${upstream}`]).pipe(
      Effect.map(parseDivergence),
    ),
  isIgnored: (repo, path) =>
    git(repo, ["check-ignore", "--quiet", path]).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false),
    ),
})
