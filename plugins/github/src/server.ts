import {
  defineServer,
  type Annotation,
  type AnnotationTarget,
  type Json,
  type ServerContext,
  type Session,
} from "@ivin/plugin-api/server"
import type { PrAnnotationData } from "@ivin/plugin-api/server"
import { isNotLoggedIn, parseAuthStatus } from "./rules/auth-status.ts"
import { readPrData, sameData, strongerRelation } from "./rules/annotation-data.ts"
import {
  bareBranch,
  hasBranchPr,
  pickBranchPr,
  readRepoView,
  type RepoInfo,
} from "./rules/branch-pr.ts"
import { createdPrUrls, createsPullRequest } from "./rules/created-prs.ts"
import { classifyGhFailure, failureMessage, GhError } from "./rules/gh-failure.ts"
import { githubIssueUrl, githubPrUrl } from "./rules/github-url.ts"
import {
  isFinished,
  POLL_EVERY,
  pollEveryFor,
  PR_VIEW_FIELDS,
  readPrView,
} from "./rules/pr-status.ts"
import { isRecord } from "./rules/is-record.ts"

const SWEEP_EVERY = 60_000
const CACHE_FOR = 5 * 60_000
const SPAWN_BUDGET = 1_500
const ACCOUNT_SETTING = "ivin.githubUser"
const LOGIN = /^[A-Za-z0-9_][\w.-]*$/

type Relation = PrAnnotationData["relation"]
type Env = { readonly GH_TOKEN: string }

interface Holder {
  readonly session: Session
  readonly annotations: ReadonlyArray<Annotation>
}

const sessionTarget = (sessionId: string): AnnotationTarget => ({ _tag: "session", sessionId })

const urlOf = (annotation: Annotation): string | null => {
  const data = readPrData(annotation.data)
  return data === null ? null : githubPrUrl(data.url)
}

export const activate = defineServer(async (ctx: ServerContext) => {
  const report = (what: string, error: unknown) =>
    console.warn(`github: ${what}: ${error instanceof Error ? error.message : String(error)}`)

  const fresh = <T>(cache: Map<string, { value: T; at: number }>, key: string): T | undefined => {
    const hit = cache.get(key)
    return hit !== undefined && Date.now() - hit.at < CACHE_FOR ? hit.value : undefined
  }
  const projectAccounts = new Map<string, { value: string | null; at: number }>()
  const tokens = new Map<string, { value: string | null; at: number }>()
  const repos = new Map<string, { value: RepoInfo | null; at: number }>()

  const accountKey = (projectPath: string) => `account:${projectPath}`

  const readProjectAccount = async (projectPath: string): Promise<string | null> => {
    const stored = await ctx.storage.get(accountKey(projectPath))
    const login =
      isRecord(stored) && (typeof stored.login === "string" || stored.login === null)
        ? stored.login
        : await readAccountFromGitConfig(projectPath)
    projectAccounts.set(projectPath, { value: login, at: Date.now() })
    return login
  }

  const readAccountFromGitConfig = async (projectPath: string): Promise<string | null> => {
    try {
      const result = await ctx.exec("git", [
        "-C",
        projectPath,
        "config",
        "--local",
        ACCOUNT_SETTING,
      ])
      return result.exitCode === 0 && result.stdout.trim() !== "" ? result.stdout.trim() : null
    } catch {
      return null
    }
  }

  const tokenOf = async (login: string): Promise<string | null> => {
    const cached = fresh(tokens, login)
    if (cached !== undefined) return cached
    let token: string | null = null
    try {
      const result = await ctx.exec("gh", [
        "auth",
        "token",
        "--hostname",
        "github.com",
        "--user",
        login,
      ])
      if (result.exitCode === 0 && result.stdout.trim() !== "") token = result.stdout.trim()
    } catch {
      token = null
    }
    tokens.set(login, { value: token, at: Date.now() })
    return token
  }

  const envFor = async (projectPath: string): Promise<Env | undefined> => {
    const login = fresh(projectAccounts, projectPath) ?? (await readProjectAccount(projectPath))
    if (login === null) return undefined
    const token = await tokenOf(login)
    return token === null ? undefined : { GH_TOKEN: token }
  }

  const gh = async (args: ReadonlyArray<string>, session: Session): Promise<string> => {
    const env = await envFor(session.projectPath)
    let result
    try {
      result = await ctx.exec("gh", args, {
        cwd: session.workingFolder,
        ...(env === undefined ? {} : { env }),
      })
    } catch (error) {
      throw new GhError(
        classifyGhFailure({ rejected: error instanceof Error ? error.message : String(error) }),
      )
    }
    if (result.exitCode !== 0) throw new GhError(classifyGhFailure({ stderr: result.stderr }))
    return result.stdout
  }

  // null: the folder has no GitHub repository.
  const repoOf = async (session: Session): Promise<RepoInfo | null> => {
    const cached = fresh(repos, session.workingFolder)
    if (cached !== undefined) return cached
    let repo: RepoInfo | null
    try {
      repo = readRepoView(
        await gh(["repo", "view", "--json", "owner,defaultBranchRef,nameWithOwner"], session),
      )
    } catch (error) {
      if (error instanceof GhError && error.failure.kind === "no-repo") repo = null
      else throw error
    }
    repos.set(session.workingFolder, { value: repo, at: Date.now() })
    return repo
  }

  const ownPr = async (sessionId: string, url: string) => {
    const own = await ctx.annotations.list(sessionTarget(sessionId), "pr")
    return own.find((annotation) => urlOf(annotation) === url)
  }

  const writePr = async (
    sessionId: string,
    url: string,
    build: (existing: PrAnnotationData | null) => PrAnnotationData,
  ): Promise<PrAnnotationData> => {
    const existing = await ownPr(sessionId, url)
    const before = existing === undefined ? null : readPrData(existing.data)
    const data = build(before)
    if (existing === undefined || !sameData(existing.data, data)) {
      await ctx.annotations.add(sessionTarget(sessionId), { kind: "pr", data })
    }
    return data
  }

  const holdersOf = async (url: string): Promise<Holder[]> => {
    const holders: Holder[] = []
    for (const session of await ctx.sessions.list()) {
      const annotations = (await ctx.annotations.listAll(sessionTarget(session.id), "pr")).filter(
        (annotation) => urlOf(annotation) === url,
      )
      if (annotations.length > 0) holders.push({ session, annotations })
    }
    return holders
  }

  const relationHeld = (holder: Holder): Relation =>
    holder.annotations.reduce<Relation>((relation, annotation) => {
      const held = readPrData(annotation.data)?.relation
      return held === undefined ? relation : strongerRelation(relation, held)
    }, "referenced")

  const polls = new Map<string, () => void>()
  const finished = new Set<string>()

  const unwatch = (url: string) => {
    polls.get(url)?.()
    polls.delete(url)
  }

  const markError = async (holders: ReadonlyArray<Holder>, url: string, error: unknown) => {
    const message =
      error instanceof GhError
        ? error.message
        : failureMessage(classifyGhFailure({ rejected: String(error) }))
    for (const holder of holders) {
      await writePr(holder.session.id, url, (existing) => ({
        ...(existing ?? { url, relation: relationHeld(holder) }),
        error: message,
      }))
    }
  }

  const checkPr = async (url: string) => {
    const holders = await holdersOf(url)
    if (holders.length === 0) {
      unwatch(url)
      return
    }
    let output: string
    try {
      output = await gh(["pr", "view", url, "--json", PR_VIEW_FIELDS], holders[0]!.session)
    } catch (error) {
      await markError(holders, url, error)
      return
    }
    const lastMerge = holders
      .flatMap((holder) => holder.annotations)
      .filter((annotation) => annotation.ns === "github")
      .map((annotation) => readPrData(annotation.data)?.merge)
      .find((merge) => merge !== undefined)
    const fields = readPrView(output, lastMerge)
    if (fields === null) {
      await markError(holders, url, new GhError({ kind: "other", detail: "" }))
      return
    }
    for (const holder of holders) {
      await writePr(holder.session.id, url, (existing) => ({
        url,
        relation: existing?.relation ?? relationHeld(holder),
        ...fields,
      }))
    }
    if (isFinished(fields.state)) {
      unwatch(url)
      finished.add(url)
      return
    }
    return { every: pollEveryFor(fields) }
  }

  const watch = (url: string) => {
    if (polls.has(url) || finished.has(url)) return
    polls.set(
      url,
      ctx.poll(`github:pr:${url}`, () => checkPr(url), { every: POLL_EVERY }),
    )
  }

  const adopt = async (
    session: Session,
    url: string,
    relation: Relation,
    initial: Partial<PrAnnotationData> = {},
  ) => {
    const data = await writePr(session.id, url, (existing) =>
      existing === null
        ? { ...initial, url, relation }
        : { ...existing, relation: strongerRelation(existing.relation, relation) },
    )
    if (isFinished(data.state)) finished.add(url)
    else watch(url)
  }

  const seenBranch = new Map<string, string | null>()
  const lookingUp = new Set<string>()

  const lookupBranch = async (session: Session) => {
    if (seenBranch.has(session.id) && seenBranch.get(session.id) === session.branch) return
    if (lookingUp.has(session.id)) return
    lookingUp.add(session.id)
    try {
      const key = `branch:${session.id}`
      const stored = await ctx.storage.get(key)
      if (isRecord(stored) && stored.branch === session.branch) {
        seenBranch.set(session.id, session.branch)
        return
      }
      if (session.branch !== null) {
        const repo = await repoOf(session)
        if (repo !== null && hasBranchPr(session.branch, repo)) {
          const list = await gh(
            [
              "pr",
              "list",
              "--head",
              bareBranch(session.branch),
              "--state",
              "all",
              "--json",
              "url,headRepositoryOwner,state,isDraft,title,updatedAt",
              "--limit",
              "20",
            ],
            session,
          )
          const pr = pickBranchPr(list, repo.owner)
          if (pr !== null) {
            const { url, ...initial } = pr
            await adopt(session, url, "branch", initial)
          }
        }
      }
      await ctx.storage.set(key, { branch: session.branch })
      seenBranch.set(session.id, session.branch)
    } finally {
      lookingUp.delete(session.id)
    }
  }

  const readCitation = (annotation: Annotation): number | null =>
    annotation.ns === "ivin" &&
    isRecord(annotation.data) &&
    typeof annotation.data.number === "number" &&
    Number.isInteger(annotation.data.number)
      ? annotation.data.number
      : null

  const resolveCitations = async (session: Session) => {
    const citations = await ctx.annotations.listAll(sessionTarget(session.id), "citation")
    const numbers = citations.map(readCitation).filter((number) => number !== null)
    if (numbers.length === 0) return
    const key = `citations:${session.id}`
    const stored = await ctx.storage.get(key)
    const done = new Set(Array.isArray(stored) ? stored : [])
    for (const number of numbers) {
      if (done.has(number)) continue
      try {
        const repo = await repoOf(session)
        if (repo !== null) {
          const issue: unknown = JSON.parse(
            await gh(["api", `repos/${repo.nameWithOwner}/issues/${number}`], session),
          )
          const link = isRecord(issue) && typeof issue.html_url === "string" ? issue.html_url : ""
          if (isRecord(issue) && issue.pull_request !== undefined && issue.pull_request !== null) {
            const url = githubPrUrl(link)
            if (url !== null) await adopt(session, url, "referenced")
          } else {
            const url = githubIssueUrl(link)
            const held = await ctx.annotations.list(sessionTarget(session.id), "issue")
            const exists = held.some(
              (annotation) => isRecord(annotation.data) && annotation.data.url === url,
            )
            if (url !== null && !exists) {
              await ctx.annotations.add(sessionTarget(session.id), {
                kind: "issue",
                data: { url, relation: "referenced" },
              })
            }
          }
        }
      } catch (error) {
        const kind = error instanceof GhError ? error.failure.kind : "other"
        if (kind !== "not-found" && kind !== "no-repo") {
          report(`citation #${number}`, error)
          continue
        }
      }
      done.add(number)
      await ctx.storage.set(key, [...done] as Json)
    }
  }

  const sweep = async () => {
    for (const session of await ctx.sessions.list()) {
      await lookupBranch(session).catch((error) => report("branch lookup", error))
      const links = await ctx.annotations.listAll(sessionTarget(session.id), "pr")
      for (const link of links) {
        const url = urlOf(link)
        if (url === null || finished.has(url)) continue
        const over = links.some(
          (other) => urlOf(other) === url && isFinished(readPrData(other.data)?.state),
        )
        if (over) finished.add(url)
        else watch(url)
      }
      await resolveCitations(session).catch((error) => report("citations", error))
    }
  }

  let sweeping: Promise<void> | null = null
  let again = false
  const sweepOnce = (): Promise<void> => {
    if (sweeping !== null) {
      again = true
      return sweeping
    }
    sweeping = (async () => {
      do {
        again = false
        await sweep()
      } while (again)
    })()
      .catch((error) => report("sweep", error))
      .finally(() => {
        sweeping = null
      })
    return sweeping
  }

  ctx.sessions.onCreated((session) => {
    lookupBranch(session).catch((error) => report("branch lookup", error))
  })
  ctx.sessions.onChanged((session) => {
    lookupBranch(session).catch((error) => report("branch lookup", error))
  })

  const creating = new Map<string, Set<string>>()
  ctx.transcript.onEvent((session, event) => {
    const toolCallId = event.toolCallId
    if (typeof toolCallId !== "string") return
    if (event.type === "tool_call") {
      if (typeof event.name === "string" && createsPullRequest(event.name, event.input)) {
        const calls = creating.get(session.id) ?? new Set<string>()
        calls.add(toolCallId)
        creating.set(session.id, calls)
      }
    } else if (event.type === "tool_result") {
      const calls = creating.get(session.id)
      if (calls === undefined || !calls.delete(toolCallId)) return
      if (event.isError === true || typeof event.output !== "string") return
      for (const url of createdPrUrls(event.output)) {
        adopt(session, url, "created").catch((error) => report("created pull request", error))
      }
    }
  })

  ctx.commands.register("github.accounts", async () => {
    let result
    try {
      result = await ctx.exec("gh", ["auth", "status"])
    } catch (error) {
      return { error: failureMessage(classifyGhFailure({ rejected: String(error) })) }
    }
    const output = `${result.stdout}\n${result.stderr}`
    const accounts = parseAuthStatus(output)
    if (accounts.length === 0 && !isNotLoggedIn(output)) {
      return { error: failureMessage(classifyGhFailure({ stderr: result.stderr })) }
    }
    return {
      accounts: accounts.map(({ host, login, active }) => ({ host, login, active })),
    }
  })

  const projectPathOf = (args: Json): string => {
    if (isRecord(args) && typeof args.projectPath === "string" && args.projectPath !== "") {
      return args.projectPath
    }
    throw new Error("A project path is required.")
  }

  ctx.commands.register("github.projectAccount", async (args) => ({
    login: await readProjectAccount(projectPathOf(args)),
  }))

  ctx.commands.register("github.setProjectAccount", async (args) => {
    const projectPath = projectPathOf(args)
    const login = isRecord(args) ? args.login : undefined
    if (login !== null && (typeof login !== "string" || !LOGIN.test(login))) {
      throw new Error("The account must be a gh login or null.")
    }
    await ctx.storage.set(accountKey(projectPath), { login })
    projectAccounts.set(projectPath, { value: login, at: Date.now() })
    return { login }
  })

  ctx.harness.beforeSpawn(async ({ sessionId }) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const budget = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), SPAWN_BUDGET)
    })
    const env = (async () => {
      const session = await ctx.sessions.get(sessionId)
      return session === undefined ? undefined : envFor(session.projectPath)
    })().catch(() => undefined)
    const found = await Promise.race([env, budget])
    clearTimeout(timer)
    return found === undefined ? undefined : { env: found }
  })

  ctx.poll("github:sweep", sweepOnce, { every: SWEEP_EVERY })
  void sweepOnce()
})
