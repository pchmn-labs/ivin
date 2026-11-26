export type PrState = "open" | "draft" | "merged" | "closed"
export type Review = "approved" | "changes" | "required" | null

export interface Check {
  readonly name: string
  readonly result: "passed" | "failed" | "running"
  readonly time: string
}

export interface Pr {
  readonly repo: string
  readonly number: number
  readonly title: string
  readonly state: PrState
  readonly checks: ReadonlyArray<Check>
  readonly review: Review
  readonly conflict: boolean
  readonly updated: string
}

export interface ProtoSession {
  readonly id: string
  readonly title: string
  readonly status: "working" | "idle" | "waiting" | "failed"
  readonly time: string
  readonly prs: ReadonlyArray<Pr>
  readonly error?: string
}

const passed = (name: string, time = "1m 12s"): Check => ({ name, result: "passed", time })
const failed = (name: string, time: string): Check => ({ name, result: "failed", time })
const running = (name: string, time: string): Check => ({ name, result: "running", time })
const suite = [passed("lint"), passed("typecheck", "48s"), passed("build", "2m 03s")]

export const SESSIONS: ReadonlyArray<ProtoSession> = [
  {
    id: "login",
    title: "Fix the login redirect after OAuth",
    status: "working",
    time: "now",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 412,
        title: "fix(auth): keep the return path through the OAuth callback",
        state: "open",
        checks: [...suite, running("unit", "running 2m"), running("e2e (linux)", "running 4m")],
        review: "required",
        conflict: false,
        updated: "1 min ago",
      },
    ],
  },
  {
    id: "rate",
    title: "Add rate limiting to the public API",
    status: "idle",
    time: "12m",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 409,
        title: "feat(server): limit each token to 600 requests a minute",
        state: "open",
        checks: [...suite, passed("unit", "3m 40s"), failed("e2e (macos)", "failed after 6m 10s")],
        review: "changes",
        conflict: false,
        updated: "9 min ago",
      },
    ],
  },
  {
    id: "drizzle",
    title: "Migrate the settings store to Drizzle",
    status: "waiting",
    time: "34m",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 401,
        title: "refactor(settings): read and write settings through Drizzle",
        state: "open",
        checks: [...suite, passed("unit", "3m 02s"), passed("e2e (linux)", "7m 31s")],
        review: "approved",
        conflict: true,
        updated: "20 min ago",
      },
      {
        repo: "pchmn-labs/ivin-docs",
        number: 58,
        title: "docs: describe the settings tables",
        state: "draft",
        checks: [],
        review: null,
        conflict: false,
        updated: "31 min ago",
      },
      {
        repo: "pchmn-labs/ivin",
        number: 396,
        title: "chore(db): add the Drizzle migration runner",
        state: "merged",
        checks: [...suite, passed("unit", "2m 58s")],
        review: "approved",
        conflict: false,
        updated: "yesterday",
      },
    ],
  },
  {
    id: "copy",
    title: "Rewrite the onboarding copy",
    status: "idle",
    time: "1h",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 415,
        title: "docs(onboarding): say what a session is before asking for a folder",
        state: "draft",
        checks: [],
        review: null,
        conflict: false,
        updated: "1 h ago",
      },
    ],
  },
  {
    id: "electron",
    title: "Bump Electron to 39",
    status: "idle",
    time: "2h",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 398,
        title: "build(desktop): update Electron to 39.2.1",
        state: "merged",
        checks: [...suite, passed("unit", "3m 11s"), passed("e2e (macos)", "8m 02s")],
        review: "approved",
        conflict: false,
        updated: "2 h ago",
      },
    ],
  },
  {
    id: "webgpu",
    title: "Try a WebGPU renderer for diffs",
    status: "idle",
    time: "3d",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 377,
        title: "feat(diff): draw long diffs with WebGPU",
        state: "closed",
        checks: [...suite, failed("unit", "failed after 1m 02s")],
        review: null,
        conflict: true,
        updated: "3 days ago",
      },
    ],
  },
  {
    id: "release",
    title: "Prepare the 0.4.0 release notes",
    status: "idle",
    time: "4h",
    error: "gh is not logged in, so this status is from 4 h ago. Run gh auth login.",
    prs: [
      {
        repo: "pchmn-labs/ivin",
        number: 404,
        title: "chore(release): 0.4.0",
        state: "open",
        checks: [...suite, passed("unit", "3m 20s")],
        review: "required",
        conflict: false,
        updated: "4 h ago",
      },
    ],
  },
  { id: "tabs", title: "Refactor the tab store", status: "idle", time: "5h", prs: [] },
]

export const TAB_IDS = ["login", "rate", "drizzle", "electron", "release"]

const STATE_ORDER: Record<PrState, number> = { open: 0, draft: 1, merged: 2, closed: 3 }
export const leadPr = (prs: ReadonlyArray<Pr>): Pr | undefined =>
  [...prs].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])[0]

export type Ci = "failed" | "running" | "passed" | "none"
export const ciOf = (checks: ReadonlyArray<Check>): Ci =>
  checks.some((c) => c.result === "failed")
    ? "failed"
    : checks.some((c) => c.result === "running")
      ? "running"
      : checks.length > 0
        ? "passed"
        : "none"

const CI_ORDER: Record<Ci, number> = { failed: 0, running: 1, passed: 2, none: 3 }
export const worstCi = (prs: ReadonlyArray<Pr>): Ci =>
  prs
    .filter((pr) => pr.state === "open" || pr.state === "draft")
    .map((pr) => ciOf(pr.checks))
    .sort((a, b) => CI_ORDER[a] - CI_ORDER[b])[0] ?? "none"

export const anyConflict = (prs: ReadonlyArray<Pr>) =>
  prs.some((pr) => pr.conflict && (pr.state === "open" || pr.state === "draft"))

export const STATE_LABEL: Record<PrState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
}

export const REVIEW_LABEL: Record<Exclude<Review, null>, string> = {
  approved: "Approved",
  changes: "Changes requested",
  required: "Review required",
}

export const count = (checks: ReadonlyArray<Check>, result: Check["result"]) =>
  checks.filter((c) => c.result === result).length

export const ciText = (checks: ReadonlyArray<Check>): string => {
  const f = count(checks, "failed")
  const r = count(checks, "running")
  const p = count(checks, "passed")
  if (checks.length === 0) return "No checks"
  if (f > 0) return `${f} failing · ${p} passed`
  if (r > 0) return `${r} running · ${p} passed`
  return `${p} passed`
}

export const urlOf = (pr: Pr) => `https://github.com/${pr.repo}/pull/${pr.number}`
