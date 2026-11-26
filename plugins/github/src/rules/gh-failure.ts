export type GhFailureKind =
  | "missing"
  | "not-logged-in"
  | "rate-limit"
  | "network"
  | "not-found"
  | "no-repo"
  | "other"

export interface GhFailure {
  readonly kind: GhFailureKind
  readonly detail: string
}

const firstLine = (text: string) =>
  (
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  ).slice(0, 160)

// `rejected` is the message of an exec that rejected (program not found, killed on its time limit).
export const classifyGhFailure = (
  failure: { readonly rejected: string } | { readonly stderr: string },
): GhFailure => {
  if ("rejected" in failure) {
    const kind = /timed? ?out|timeout/i.test(failure.rejected) ? "network" : "missing"
    return { kind, detail: firstLine(failure.rejected) }
  }
  const stderr = failure.stderr
  const detail = firstLine(stderr)
  if (/gh auth login|not logged in|authentication required|bad credentials/i.test(stderr)) {
    return { kind: "not-logged-in", detail }
  }
  if (/API rate limit|secondary rate limit/i.test(stderr)) return { kind: "rate-limit", detail }
  if (/none of the git remotes|not a git repository|no git remotes/i.test(stderr)) {
    return { kind: "no-repo", detail }
  }
  if (/HTTP 404|Not Found|Could not resolve to/i.test(stderr)) return { kind: "not-found", detail }
  if (
    /error connecting|could not resolve host|dial tcp|network is unreachable|ECONN|ENOTFOUND|ETIMEDOUT|timeout|i\/o timeout|EAI_AGAIN/i.test(
      stderr,
    )
  ) {
    return { kind: "network", detail }
  }
  return { kind: "other", detail }
}

export const failureMessage = (failure: GhFailure): string => {
  switch (failure.kind) {
    case "missing":
      return "gh is not installed, so the pull request's status cannot be read."
    case "not-logged-in":
      return "gh is not logged in. Run gh auth login."
    case "rate-limit":
      return "GitHub's rate limit is reached. The status is read again at the next check."
    case "network":
      return "GitHub could not be reached. The status is read again at the next check."
    case "not-found":
      return "GitHub does not show this pull request to the account gh uses."
    case "no-repo":
      return "This folder has no GitHub repository."
    case "other":
      return failure.detail === ""
        ? "gh failed to read the pull request's status. It is read again at the next check."
        : `gh failed: ${failure.detail}`
  }
}

export class GhError extends Error {
  readonly failure: GhFailure
  constructor(failure: GhFailure) {
    super(failureMessage(failure))
    this.failure = failure
  }
}
