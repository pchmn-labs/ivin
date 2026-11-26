import type { PrAnnotationData } from "@ivin/plugin-api/server"
import { githubPrUrl } from "./github-url.ts"
import { stateOf } from "./pr-status.ts"

export interface RepoInfo {
  readonly nameWithOwner: string
  readonly owner: string
  readonly defaultBranch: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const readRepoView = (json: string): RepoInfo | null => {
  try {
    const view: unknown = JSON.parse(json)
    if (
      !isRecord(view) ||
      !isRecord(view.owner) ||
      typeof view.owner.login !== "string" ||
      typeof view.nameWithOwner !== "string"
    ) {
      return null
    }
    const branch = isRecord(view.defaultBranchRef) ? view.defaultBranchRef.name : null
    return {
      nameWithOwner: view.nameWithOwner,
      owner: view.owner.login,
      defaultBranch: typeof branch === "string" ? branch : null,
    }
  } catch {
    return null
  }
}

// `gh pr list --head` takes the branch name, not a ref.
export const bareBranch = (branch: string): string => branch.replace(/^refs\/heads\//, "")

// A session on the default branch has no PR of its own: release PRs from main must not attach.
export const hasBranchPr = (branch: string | null, repo: RepoInfo): branch is string =>
  branch !== null && bareBranch(branch) !== repo.defaultBranch

type Fields = Pick<PrAnnotationData, "title" | "state" | "activityAt">

export interface BranchPr extends Fields {
  readonly url: string
}

// Open first, then the most recently updated; a fork's PR from the same branch name is left out.
export const pickBranchPr = (json: string, repoOwner: string): BranchPr | null => {
  let list: unknown
  try {
    list = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(list)) return null
  const candidates: Array<BranchPr & { open: boolean; updated: number }> = []
  for (const item of list) {
    if (!isRecord(item) || typeof item.url !== "string") continue
    const owner = isRecord(item.headRepositoryOwner) ? item.headRepositoryOwner.login : null
    if (typeof owner !== "string" || owner.toLowerCase() !== repoOwner.toLowerCase()) continue
    const url = githubPrUrl(item.url)
    const state = stateOf(item.state, item.isDraft)
    if (url === null || state === undefined) continue
    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : undefined
    candidates.push({
      url,
      state,
      ...(typeof item.title === "string" ? { title: item.title } : {}),
      ...(updatedAt === undefined ? {} : { activityAt: updatedAt }),
      open: state === "open" || state === "draft",
      updated: updatedAt === undefined ? 0 : Date.parse(updatedAt) || 0,
    })
  }
  candidates.sort((a, b) => Number(b.open) - Number(a.open) || b.updated - a.updated)
  const best = candidates[0]
  if (best === undefined) return null
  const { open: _open, updated: _updated, ...pr } = best
  return pr
}
