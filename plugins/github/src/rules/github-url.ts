const OWNER_AND_REPO = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/([1-9]\d*)(?:\/|$)/
const CANDIDATE = /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|issues)\/\d+/gi

type Kind = "pr" | "issue"

const normalise = (text: string, kind: Kind): string | null => {
  if (!URL.canParse(text)) return null
  const url = new URL(text)
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null
  const match = OWNER_AND_REPO.exec(url.pathname)
  if (match === null || match[3] !== (kind === "pr" ? "pull" : "issues")) return null
  return `https://github.com/${match[1]!.toLowerCase()}/${match[2]!.toLowerCase()}/${match[3]}/${match[4]}`
}

export const githubPrUrl = (text: string): string | null => normalise(text, "pr")

export const githubIssueUrl = (text: string): string | null => normalise(text, "issue")

export const githubPrUrlsIn = (text: string): string[] => {
  const urls = new Set<string>()
  for (const candidate of text.matchAll(CANDIDATE)) {
    const url = githubPrUrl(candidate[0])
    if (url !== null) urls.add(url)
  }
  return [...urls]
}
