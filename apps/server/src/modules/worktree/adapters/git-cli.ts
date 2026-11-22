import type { Change } from "@ivin/contracts/file"
import { parseChanges } from "../../file/rules/changes.ts"
import { parseGitStatus } from "../../file/rules/git-status.ts"
import { Effect, Layer } from "effect"
import { execFile } from "node:child_process"
import { realpathSync } from "node:fs"
import {
  parseBranches,
  parseDivergence,
  parsePatchIds,
  parseWorktreeList,
  underOpenedPath,
} from "../rules/git-output.ts"
import { hasOwnCommits, isSquashMerged, mergeAddsNothing } from "../rules/merge-state.ts"
import { Git, GitError } from "../usecases/git.ts"

interface ExecFailure {
  readonly stderr?: string
  readonly message?: string
  readonly code?: number | string
}

class OutputTooLong {
  readonly _tag = "OutputTooLong"
}

const run = (
  cwd: string,
  args: readonly string[],
  {
    input,
    maxBuffer = 16 << 20,
    succeedsOn = [0],
  }: {
    readonly input?: string
    readonly maxBuffer?: number
    readonly succeedsOn?: ReadonlyArray<number>
  } = {},
) =>
  Effect.callback<string, GitError | OutputTooLong>((resume, signal) => {
    const child = execFile(
      "git",
      args,
      // A fetch must never wait on a credential prompt nobody can answer.
      { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, maxBuffer },
      (error, stdout) => {
        if (!error) return resume(Effect.succeed(stdout))
        const failure = error as ExecFailure
        if (failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
          return resume(Effect.fail(new OutputTooLong()))
        if (typeof failure.code === "number" && succeedsOn.includes(failure.code))
          return resume(Effect.succeed(stdout))
        const message = failure.stderr?.trim() || failure.message || "git failed"
        resume(Effect.fail(new GitError({ message })))
      },
    )
    // git may exit before reading its input, such as outside a repository; its exit code reports that.
    child.stdin?.on("error", () => {})
    if (input !== undefined) child.stdin?.end(input)
    // Not execFile's `signal`: aborting a spawn that failed, such as on a missing cwd, kills our process group.
    signal.addEventListener("abort", () => child.pid !== undefined && child.kill(), { once: true })
  })

const git = (cwd: string, args: readonly string[], input?: string) =>
  run(cwd, args, input === undefined ? {} : { input }).pipe(
    Effect.catchTag("OutputTooLong", () =>
      Effect.fail(new GitError({ message: "git wrote too much" })),
    ),
  )

// What a diff compares the working folder with: HEAD, or the empty tree before the first commit.
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
const diffBase = (folder: string) =>
  orNull(git(folder, ["rev-parse", "--verify", "--quiet", "HEAD"])).pipe(
    Effect.map((head) => (head === null ? EMPTY_TREE : "HEAD")),
  )

// No optional locks: a diff that refreshed the index would fire the watcher that asked for it.
const DIFF = ["--no-optional-locks", "diff", "--no-color", "--no-ext-diff", "--relative", "-M"]

const listChanges = (folder: string) =>
  Effect.gen(function* () {
    if ((yield* orNull(git(folder, ["rev-parse", "--show-prefix"]))) === null) return null
    const base = yield* diffBase(folder)
    const nameStatus = yield* git(folder, [...DIFF, "--name-status", "-z", base, "--"])
    const numstat = yield* git(folder, [...DIFF, "--numstat", "-z", base, "--"])
    const untracked = yield* git(folder, ["ls-files", "-z", "--others", "--exclude-standard"])
    return parseChanges(nameStatus, numstat, untracked)
  })

const diffOf = (folder: string, change: Change, limit: number) =>
  Effect.gen(function* () {
    // git diff --no-index exits 1 when the files differ.
    if (change.status === "untracked")
      return yield* run(
        folder,
        ["diff", "--no-color", "--no-ext-diff", "--no-index", "--", "/dev/null", change.path],
        { maxBuffer: limit, succeedsOn: [1] },
      )
    const paths = change.previousPath === null ? [change.path] : [change.previousPath, change.path]
    return yield* run(folder, [...DIFF, yield* diffBase(folder), "--", ...paths], {
      maxBuffer: limit,
    })
  }).pipe(Effect.catchTag("OutputTooLong", () => Effect.succeed(null)))

const orNull = <A>(effect: Effect.Effect<A, GitError>) =>
  effect.pipe(Effect.orElseSucceed(() => null))

const patchIds = (cwd: string, patches: string) =>
  git(cwd, ["patch-id", "--stable"], `${patches}\n`).pipe(Effect.map(parsePatchIds))

const squashMerged = (folder: string, base: string, target: string) =>
  Effect.gen(function* () {
    const diffArgs = ["--no-color", "--no-ext-diff", "--binary"]
    const diff = yield* git(folder, ["diff", ...diffArgs, base, "HEAD"])
    const log = yield* git(folder, ["log", "-p", ...diffArgs, "--no-merges", `${base}..${target}`])
    return isSquashMerged(yield* patchIds(folder, diff), yield* patchIds(folder, log))
  })

const isMergedInto = (folder: string, target: string) =>
  Effect.gen(function* () {
    const head = (yield* git(folder, ["rev-parse", "HEAD"])).trim()
    const base = (yield* git(folder, ["merge-base", "HEAD", target])).trim()
    const firstParents = yield* git(folder, [
      "rev-list",
      "--first-parent",
      target,
      "--not",
      "HEAD^@",
    ])
    const hasCommits = hasOwnCommits(head, base, firstParents.split("\n"))
    const targetTree = (yield* git(folder, ["rev-parse", `${target}^{tree}`])).trim()
    // merge-tree fails on a conflict.
    const mergeTree = yield* orNull(git(folder, ["merge-tree", "--write-tree", target, "HEAD"]))
    if (mergeAddsNothing(mergeTree, targetTree)) return { merged: true, hasCommits }
    return { merged: hasCommits && (yield* squashMerged(folder, base, target)), hasCommits }
  })

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
  isClean: (folder) =>
    git(folder, ["status", "--porcelain", "--untracked-files=normal"]).pipe(
      Effect.map((out) => out.trim() === ""),
    ),
  isMergedInto,
  removeWorktree: (repo, path) => git(repo, ["worktree", "remove", path]).pipe(Effect.asVoid),
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
  ignoredNames: (folder, names) =>
    names.length === 0
      ? Effect.succeed(new Set())
      : git(folder, ["check-ignore", "-z", "--stdin"], names.join("\0")).pipe(
          Effect.map((out) => new Set(out.split("\0").filter((name) => name !== ""))),
          // check-ignore exits 1 when nothing is ignored, and 128 outside a repository.
          Effect.orElseSucceed(() => new Set<string>()),
        ),
  statusOf: (folder) =>
    Effect.gen(function* () {
      const prefix = yield* git(folder, ["rev-parse", "--show-prefix"])
      // No optional locks: a status that rewrote the index would fire the watcher that asked for it.
      const output = yield* git(folder, [
        "--no-optional-locks",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--",
        ".",
      ])
      return parseGitStatus(output, prefix.trim())
    }).pipe(Effect.orElseSucceed(() => [])),
  gitDir: (folder) =>
    orNull(git(folder, ["rev-parse", "--absolute-git-dir"])).pipe(
      Effect.map((out) => out?.trim() || null),
    ),
  listFiles: (folder) =>
    Effect.gen(function* () {
      const listed = yield* git(folder, [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ])
      const deleted = new Set((yield* git(folder, ["ls-files", "-z", "--deleted"])).split("\0"))
      return listed.split("\0").filter((path) => path !== "" && !deleted.has(path))
    }).pipe(Effect.orElseSucceed(() => null)),
  listChanges,
  diffOf,
})
