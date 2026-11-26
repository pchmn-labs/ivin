import type { PrAnnotationData } from "@ivin/plugin-api/ui"

type State = NonNullable<PrAnnotationData["state"]>

export interface Pr {
  readonly url: string
  readonly title?: string
  readonly state?: State
  readonly checks?: PrAnnotationData["checks"]
  readonly checkCounts?: PrAnnotationData["checkCounts"]
  readonly review?: PrAnnotationData["review"]
  readonly merge?: PrAnnotationData["merge"]
  readonly activityAt?: string
  readonly error?: string
  readonly annotationIds: ReadonlyArray<string>
}

interface Source {
  readonly id: string
  readonly data: PrAnnotationData
}

const STATE_ORDER: Record<State, number> = { open: 0, draft: 1, merged: 2, closed: 3 }
const UNKNOWN_STATE = 4

const isLive = (pr: Pr) => pr.state === "open" || pr.state === "draft"

const activityOf = (pr: Pr) => (pr.activityAt === undefined ? 0 : Date.parse(pr.activityAt) || 0)

const pick = <K extends keyof PrAnnotationData>(sources: ReadonlyArray<Source>, key: K) =>
  sources.findLast((source) => source.data[key] !== undefined)?.data[key]

// Sources are oldest first; the newest annotation that has a field wins.
export const groupPrs = (sources: ReadonlyArray<Source>): ReadonlyArray<Pr> => {
  const byUrl = new Map<string, Source[]>()
  for (const source of sources) {
    byUrl.set(source.data.url, [...(byUrl.get(source.data.url) ?? []), source])
  }
  const prs = [...byUrl].map(([url, group]): Pr => {
    const status = group.filter((source) => source.data.state !== undefined)
    const from = status.length > 0 ? status : group
    const fields = {
      title: pick(from, "title") ?? pick(group, "title"),
      state: pick(from, "state"),
      checks: pick(from, "checks"),
      checkCounts: pick(from, "checkCounts"),
      review: pick(from, "review"),
      merge: pick(from, "merge"),
      activityAt: pick(from, "activityAt"),
      error: pick(group, "error"),
    }
    return {
      url,
      annotationIds: group.map((source) => source.id),
      ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    }
  })
  return prs.toSorted(
    (a, b) =>
      (a.state === undefined ? UNKNOWN_STATE : STATE_ORDER[a.state]) -
        (b.state === undefined ? UNKNOWN_STATE : STATE_ORDER[b.state]) ||
      activityOf(b) - activityOf(a),
  )
}

export type TileMark = "check" | "cross" | "exclamation"
export type TileTone = "danger" | "muted" | "hue-0" | "hue-3" | "hue-4"

export interface Tile {
  readonly icon:
    | "git-pull-request"
    | "git-pull-request-draft"
    | "git-merge"
    | "git-pull-request-closed"
  readonly tone: TileTone
  readonly mark?: TileMark
  readonly pulse: boolean
  readonly label: string
}

const ICON = {
  open: "git-pull-request",
  draft: "git-pull-request-draft",
  merged: "git-merge",
  closed: "git-pull-request-closed",
} as const

const LEAD_TONE = { open: "hue-0", draft: "muted", merged: "hue-3", closed: "hue-4" } as const

const markOf = (live: ReadonlyArray<Pr>): TileMark | undefined => {
  if (live.some((pr) => pr.merge === "conflict" || pr.checks === "failing")) return "cross"
  const open = live.filter((pr) => pr.state === "open")
  if (open.some((pr) => pr.merge === "ready")) return "check"
  if (open.some((pr) => pr.review === "review_required" || pr.review === "changes_requested")) {
    return "exclamation"
  }
  return undefined
}

const labelOf = (lead: Pr | undefined, mark: TileMark | undefined, pulse: boolean) => {
  const parts = [lead?.state === undefined ? "Pull request" : `Pull request, ${lead.state}`]
  if (mark === "cross") parts.push("needs attention")
  else if (mark === "check") parts.push("ready to merge")
  else if (mark === "exclamation") parts.push("waiting for review")
  if (pulse) parts.push("checks running")
  return parts.join(", ")
}

// `prs` is in lead order, so its first pull request is the lead.
export const tileOf = (prs: ReadonlyArray<Pr>): Tile => {
  const lead = prs[0]
  const live = prs.filter(isLive)
  const mark = markOf(live)
  const pulse = live.some((pr) => pr.checks === "pending")
  const failing = live.some((pr) => pr.checks === "failing")
  return {
    icon: lead?.state === undefined ? "git-pull-request" : ICON[lead.state],
    tone: failing ? "danger" : lead?.state === undefined ? "muted" : LEAD_TONE[lead.state],
    ...(mark !== undefined && { mark }),
    pulse,
    label: labelOf(lead, mark, pulse),
  }
}

export interface PillSpec {
  readonly tone: "accent" | "danger" | "muted"
  readonly icon?: "circle-alert" | "git-merge"
  readonly status?: "passed" | "failed" | "running"
  readonly text: string
}

const checksPill = (pr: Pr): PillSpec | undefined => {
  const counts = pr.checkCounts
  const passed = counts === undefined ? "" : ` · ${counts.passed} passed`
  if (pr.checks === "failing") {
    return {
      tone: "danger",
      status: "failed",
      text: counts === undefined ? "Checks failing" : `${counts.failed} failing${passed}`,
    }
  }
  if (pr.checks === "pending") {
    return {
      tone: "muted",
      status: "running",
      text: counts === undefined ? "Checks running" : `${counts.pending} running${passed}`,
    }
  }
  if (pr.checks === "passing") {
    return {
      tone: "accent",
      status: "passed",
      text: counts === undefined ? "Checks passed" : `${counts.passed} passed`,
    }
  }
  return undefined
}

const mergePill = (pr: Pr): PillSpec | undefined => {
  if (pr.merge === "conflict")
    return { tone: "danger", icon: "circle-alert", text: "Has conflicts" }
  if (pr.review === "changes_requested") {
    return { tone: "danger", icon: "circle-alert", text: "Changes requested" }
  }
  if (pr.review === "review_required") return { tone: "muted", text: "Review required" }
  if (pr.merge === "ready") return { tone: "accent", icon: "git-merge", text: "Ready to merge" }
  return undefined
}

export const pillsOf = (pr: Pr): ReadonlyArray<PillSpec> => {
  if (!isLive(pr)) return []
  const checks = checksPill(pr)
  const merge = pr.state === "open" ? mergePill(pr) : undefined
  return [checks, merge].filter((pill) => pill !== undefined)
}

export const errorsOf = (prs: ReadonlyArray<Pr>): ReadonlyArray<string> => [
  ...new Set(prs.flatMap((pr) => (pr.error === undefined ? [] : [pr.error]))),
]

// `owner/repo` and the number of a pull request or merge request URL, when it has that shape.
export const parsePrUrl = (
  url: string,
): { readonly repo: string; readonly number: string } | undefined => {
  const match = /^https?:\/\/[^/]+\/(.+?)\/(?:-\/)?(?:pull|pulls|merge_requests)\/(\d+)/.exec(url)
  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : { repo: match[1], number: match[2] }
}

export const repoName = (repo: string) => repo.slice(repo.lastIndexOf("/") + 1)

export const fallbackTitle = (url: string) => {
  const parsed = parsePrUrl(url)
  return parsed === undefined ? url : `${parsed.repo}#${parsed.number}`
}
