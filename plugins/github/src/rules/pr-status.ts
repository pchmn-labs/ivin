import type { PrAnnotationData } from "@ivin/plugin-api/server"

export const PR_VIEW_FIELDS =
  "state,isDraft,title,statusCheckRollup,reviewDecision,mergeable,mergeStateStatus,updatedAt"

export const POLL_EVERY = 180_000
export const POLL_EVERY_WHILE_PENDING = 45_000

type Fields = Pick<
  PrAnnotationData,
  "title" | "state" | "checks" | "checkCounts" | "review" | "merge" | "activityAt"
>

const FAILED = new Set([
  "FAILURE",
  "TIMED_OUT",
  "CANCELLED",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
  "ERROR",
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string => (typeof value === "string" ? value : "")

type CheckOutcome = "passed" | "failed" | "pending"

// A check run reports `status` then `conclusion`; a commit status reports `state`.
const outcomeOf = (item: Record<string, unknown>): CheckOutcome => {
  if (item.__typename === "StatusContext" || "state" in item) {
    const state = text(item.state)
    if (state === "PENDING" || state === "EXPECTED") return "pending"
    return FAILED.has(state) ? "failed" : "passed"
  }
  if (text(item.status) !== "COMPLETED") return "pending"
  return FAILED.has(text(item.conclusion)) ? "failed" : "passed"
}

export const checksOf = (rollup: unknown): Pick<Fields, "checks" | "checkCounts"> => {
  if (!Array.isArray(rollup) || rollup.length === 0) return {}
  const counts = { passed: 0, failed: 0, pending: 0 }
  for (const item of rollup) if (isRecord(item)) counts[outcomeOf(item)] += 1
  if (counts.passed + counts.failed + counts.pending === 0) return {}
  const checks = counts.failed > 0 ? "failing" : counts.pending > 0 ? "pending" : "passing"
  return { checks, checkCounts: counts }
}

const reviewOf = (decision: unknown): Fields["review"] => {
  switch (decision) {
    case "APPROVED":
      return "approved"
    case "CHANGES_REQUESTED":
      return "changes_requested"
    case "REVIEW_REQUIRED":
      return "review_required"
    default:
      return undefined
  }
}

// GitHub computes mergeability lazily, so UNKNOWN keeps what an earlier check found.
export const mergeOf = (
  mergeable: unknown,
  mergeState: unknown,
  last: PrAnnotationData["merge"],
): PrAnnotationData["merge"] => {
  if (mergeable === "CONFLICTING" || mergeState === "DIRTY") return "conflict"
  if (mergeable === "UNKNOWN" || mergeState === "UNKNOWN") return last
  if (mergeState === "CLEAN" || mergeState === "HAS_HOOKS" || mergeState === "UNSTABLE") {
    return "ready"
  }
  return "blocked"
}

export const stateOf = (state: unknown, isDraft: unknown): PrAnnotationData["state"] => {
  if (state === "MERGED") return "merged"
  if (state === "CLOSED") return "closed"
  if (state === "OPEN") return isDraft === true ? "draft" : "open"
  return undefined
}

// The fields of `gh pr view --json <PR_VIEW_FIELDS>`; null when the output is not that.
export const readPrView = (json: string, lastMerge: PrAnnotationData["merge"]): Fields | null => {
  let view: unknown
  try {
    view = JSON.parse(json)
  } catch {
    return null
  }
  if (!isRecord(view)) return null
  const state = stateOf(view.state, view.isDraft)
  if (state === undefined) return null
  const finished = state === "merged" || state === "closed"
  const review = reviewOf(view.reviewDecision)
  const merge = finished ? undefined : mergeOf(view.mergeable, view.mergeStateStatus, lastMerge)
  return {
    state,
    ...(typeof view.title === "string" ? { title: view.title } : {}),
    ...checksOf(view.statusCheckRollup),
    ...(review === undefined ? {} : { review }),
    ...(merge === undefined ? {} : { merge }),
    ...(typeof view.updatedAt === "string" ? { activityAt: view.updatedAt } : {}),
  }
}

export const isFinished = (state: PrAnnotationData["state"]) =>
  state === "merged" || state === "closed"

export const pollEveryFor = (fields: Fields): number =>
  fields.checks === "pending" ? POLL_EVERY_WHILE_PENDING : POLL_EVERY
