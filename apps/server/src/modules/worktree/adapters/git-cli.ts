import type { Change } from "@ivin/contracts/file"
import { parseChanges } from "../rules/changes.ts"
import { parseGitStatus } from "../rules/git-status.ts"
import { Context, Effect, Layer } from "effect"
import { execFile } from "node:child_process"
import { realpathSync } from "node:fs"
import {
  parseBranches,
  parseDivergence,
  parsePatchIds,
  parseWorktreeList,
  underOpenedPath,
} from "../rules/git-output.ts"
import { ProjectTrust } from "../../project/usecases/project-trust.ts"
import {
  LoginShellPath,
  type LoginShellPathService,
} from "../../../shared/usecases/login-shell-path.ts"
import { commandOf, withOverrides } from "../rules/git-overrides.ts"
import { type GitTimeLimit, timeLimitOf } from "../rules/git-time-limit.ts"
import { hasOwnCommits, isSquashMerged, mergeAddsNothing } from "../rules/merge-state.ts"
import { type CommitRange, Git, GitError } from "../usecases/git.ts"

interface ExecFailure {
  readonly stderr?: string
  readonly message?: string
  readonly code?: number | string
}

class OutputTooLong {
  readonly _tag = "OutputTooLong"
}

export type GitTimeLimits = Record<GitTimeLimit, `${number} ${"millis" | "seconds" | "minutes"}`>

const GIT_TIME_LIMITS: GitTimeLimits = { short: "30 seconds", long: "10 minutes" }

class TimeLimits extends Context.Service<TimeLimits, GitTimeLimits>()(
  "ivin/server/GitTimeLimits",
) {}

const runGit = (
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
  Effect.gen(function* () {
    if (!(yield* (yield* ProjectTrust).isTrusted(cwd)))
      return yield* new GitError({
        message: `${cwd}${NO_TRUSTED_PROJECT}`,
      })
    // git hooks and filters run programs found on the login shell's PATH.
    yield* (yield* LoginShellPath).ready
    const limit = (yield* TimeLimits)[timeLimitOf(args)]
    // Interrupting spawnGit kills the child.
    return yield* spawnGit(cwd, args, input, maxBuffer, succeedsOn).pipe(
      Effect.timeoutOrElse({
        duration: limit,
        orElse: () =>
          Effect.fail(
            new GitError({
              message: `git ${commandOf(args)} did not finish within ${limit}`,
            }),
          ),
      }),
    )
  })

const NO_TRUSTED_PROJECT = " is in no trusted project, so ivin runs no git command in it."

const spawnGit = (
  cwd: string,
  args: readonly string[],
  input: string | undefined,
  maxBuffer: number,
  succeedsOn: ReadonlyArray<number>,
) =>
  Effect.callback<string, GitError | OutputTooLong>((resume, signal) => {
    const child = execFile(
      "git",
      withOverrides(args),
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
  runGit(cwd, args, input === undefined ? {} : { input }).pipe(
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

// HEAD's commit, null outside a repository; one process except before the first commit.
const diffBaseInRepository = (folder: string) =>
  orNull(git(folder, ["rev-parse", "--show-prefix", "HEAD"])).pipe(
    Effect.flatMap((out) => {
      if (out !== null) return Effect.succeed({ base: out.split("\n")[1] ?? EMPTY_TREE })
      return orNull(git(folder, ["rev-parse", "--show-prefix"])).pipe(
        Effect.map((prefix) => (prefix === null ? null : { base: EMPTY_TREE })),
      )
    }),
  )

// No optional locks: a diff that refreshed the index would fire the watcher that asked for it.
// Literal pathspecs: a path such as `[id].ts` is a file name, not a pattern that matches `i.ts`.
const LITERAL = "--literal-pathspecs"
// No diff driver: a repository's config must not make reading a diff run its command.
const PLAIN_DIFF = ["--no-color", "--no-ext-diff", "--no-textconv"]
const DIFF = ["--no-optional-locks", LITERAL, "diff", ...PLAIN_DIFF, "--relative", "-M"]

const sidesOf = (range: CommitRange) =>
  range.to === undefined ? [range.from] : [range.from, range.to]

const listChanges = (folder: string, given?: CommitRange) =>
  Effect.gen(function* () {
    let range = given
    if (range === undefined) {
      const found = yield* diffBaseInRepository(folder)
      if (found === null) return null
      range = { from: found.base }
    } else if ((yield* orNull(git(folder, ["rev-parse", "--show-prefix"]))) === null) return null
    const sides = sidesOf(range)
    const nameStatus = yield* git(folder, [...DIFF, "--name-status", "-z", ...sides, "--"])
    const numstat = yield* git(folder, [...DIFF, "--numstat", "-z", ...sides, "--"])
    const untracked =
      range.to === undefined
        ? yield* git(folder, ["ls-files", "-z", "--others", "--exclude-standard"])
        : ""
    return { range, changes: parseChanges(nameStatus, numstat, untracked) }
  })

const changedPaths = (change: Change) =>
  change.previousPath === null ? [change.path] : [change.previousPath, change.path]

const diffOf = (folder: string, change: Change, limit: number, range: CommitRange) =>
  Effect.gen(function* () {
    // git diff --no-index exits 1 when the files differ.
    if (change.status === "untracked")
      return yield* runGit(
        folder,
        ["diff", ...PLAIN_DIFF, "--no-index", "--", "/dev/null", change.path],
        { maxBuffer: limit, succeedsOn: [1] },
      )
    return yield* runGit(folder, [...DIFF, ...sidesOf(range), "--", ...changedPaths(change)], {
      maxBuffer: limit,
    })
  }).pipe(Effect.catchTag("OutputTooLong", () => Effect.succeed(null)))

const orNull = <A, R>(effect: Effect.Effect<A, GitError, R>) =>
  effect.pipe(Effect.orElseSucceed(() => null))

// Outside a repository, or in an untrusted folder where no git runs, there is nothing to read; any other failure, a time limit included, fails.
const nullOutsideRepository = (error: GitError) =>
  error.message.includes("not a git repository") || error.message.endsWith(NO_TRUSTED_PROJECT)
    ? Effect.succeed(null)
    : Effect.fail(error)

const prefixInRepository = (folder: string) =>
  git(folder, ["rev-parse", "--show-prefix"]).pipe(Effect.catch(nullOutsideRepository))

const patchIds = (cwd: string, patches: string) =>
  git(cwd, ["patch-id", "--stable"], `${patches}\n`).pipe(Effect.map(parsePatchIds))

const squashMerged = (folder: string, base: string, target: string) =>
  Effect.gen(function* () {
    const diffArgs = [...PLAIN_DIFF, "--binary"]
    const diff = yield* git(folder, ["diff", ...diffArgs, base, "HEAD"])
    const log = yield* git(folder, [
      "log",
      "-p",
      ...diffArgs,
      "--no-show-signature",
      "--no-merges",
      `${base}..${target}`,
    ])
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

type GitShape = Git["Service"]
type Untrusted = {
  readonly [K in keyof GitShape]: GitShape[K] extends (
    ...args: infer A
  ) => Effect.Effect<infer S, infer E>
    ? (...args: A) => Effect.Effect<S, E, ProjectTrust | TimeLimits>
    : never
}

const trusting = (
  methods: Untrusted,
  trust: ProjectTrust["Service"],
  limits: GitTimeLimits,
  loginShellPath: LoginShellPathService,
) =>
  Object.fromEntries(
    Object.entries(methods).map(([name, method]) => [
      name,
      (...args: never[]) =>
        (
          method as (...args: never[]) => Effect.Effect<unknown, unknown, ProjectTrust | TimeLimits>
        )(...args).pipe(
          Effect.provideService(ProjectTrust, trust),
          Effect.provideService(TimeLimits, limits),
          Effect.provideService(LoginShellPath, loginShellPath),
        ),
    ]),
  ) as unknown as GitShape

const methods: Untrusted = {
  listWorktrees: (repo) =>
    git(repo, ["worktree", "list", "--porcelain"]).pipe(
      Effect.map((out) => underOpenedPath(parseWorktreeList(out), repo, realpathSync(repo))),
      Effect.catch(nullOutsideRepository),
      Effect.map((entries) => entries ?? []),
    ),
  listBranches: (repo) =>
    git(repo, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"]).pipe(
      Effect.map(parseBranches),
      Effect.catch(nullOutsideRepository),
      Effect.map((branches) => branches ?? { local: [], remote: [] }),
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
    Effect.gen(function* () {
      const latest = orNull(git(folder, ["rev-parse", "--quiet", "--verify", "refs/stash"]))
      const before = yield* latest
      yield* git(folder, ["stash", "push", "--include-untracked", "-m", message])
      return (yield* latest) !== before
    }),
  popStash: (folder) => git(folder, ["stash", "pop", "--quiet"]).pipe(Effect.asVoid),
  headCommit: (folder) =>
    orNull(git(folder, ["rev-parse", "--verify", "HEAD"])).pipe(
      Effect.map((out) => out?.trim() || null),
    ),
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
      const prefix = yield* prefixInRepository(folder)
      if (prefix === null) return []
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
    }),
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
    }).pipe(Effect.catch(nullOutsideRepository)),
  listChanges,
  diffOf,
  tips: (folder) =>
    orNull(
      git(folder, [
        "rev-parse",
        "HEAD",
        "refs/remotes/origin/HEAD",
        "--abbrev-ref",
        "refs/remotes/origin/HEAD",
      ]),
    ).pipe(
      Effect.map((out) => {
        const [head, baseCommit, base] = out?.trim().split("\n") ?? []
        return head && baseCommit && base ? { head, base, baseCommit } : null
      }),
    ),
  hasCommit: (folder) => diffBase(folder).pipe(Effect.map((base) => base === "HEAD")),
  // merge-base exits 1, with no output, when the histories share no commit.
  mergeBase: (folder, target) =>
    runGit(folder, ["merge-base", "HEAD", target], { succeedsOn: [1] }).pipe(
      Effect.map((out) => out.trim() || null),
      Effect.catchTag("OutputTooLong", () =>
        Effect.fail(new GitError({ message: "git wrote too much" })),
      ),
    ),
  discard: (folder, changes) =>
    Effect.gen(function* () {
      const untracked = changes.filter((change) => change.status === "untracked")
      const tracked = changes.filter((change) => change.status !== "untracked")
      if (tracked.length > 0)
        yield* git(folder, [
          LITERAL,
          "restore",
          `--source=${yield* diffBase(folder)}`,
          "--staged",
          "--worktree",
          "--",
          ...tracked.flatMap(changedPaths),
        ])
      if (untracked.length > 0)
        yield* git(folder, [
          LITERAL,
          "clean",
          "--force",
          "--quiet",
          "--",
          ...untracked.map((change) => change.path),
        ])
    }),
}

export const layerGitCliWith = (limits: GitTimeLimits) =>
  Layer.effect(Git)(
    Effect.gen(function* () {
      return trusting(methods, yield* ProjectTrust, limits, yield* LoginShellPath)
    }),
  )

export const layerGitCli = layerGitCliWith(GIT_TIME_LIMITS)
