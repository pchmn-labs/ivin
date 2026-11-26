import { githubPrUrlsIn } from "./github-url.ts"

const CREATE_COMMAND = /(?:^|[\s;&|(`'"])gh\s+pr\s+create(?:\s|$|[;&|)`'"])/
const CREATE_TOOL_SUFFIX = "create_pull_request"

const strings = (value: unknown, found: string[] = []): string[] => {
  if (typeof value === "string") found.push(value)
  else if (Array.isArray(value)) for (const item of value) strings(item, found)
  else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) strings(item, found)
  }
  return found
}

// Only the shell command or the MCP tool that opens a PR counts; reading one (gh pr view, get_*) does not.
export const createsPullRequest = (toolName: string, input: unknown): boolean =>
  toolName.endsWith(CREATE_TOOL_SUFFIX) || strings(input).some((text) => CREATE_COMMAND.test(text))

export const createdPrUrls = (output: string): string[] => githubPrUrlsIn(output)
