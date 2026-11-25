export interface AgentCommand {
  readonly name: string
  readonly description: string
  readonly argumentHint: string | null
  readonly kind: "skill" | "command"
  // Where a skill comes from; null for Claude's own commands.
  readonly source: "project" | "user" | "plugin" | "built-in" | null
}

export const SOURCE_LABEL = {
  project: "Project",
  user: "User",
  plugin: "Plugin",
  "built-in": "Built-in",
} as const

// Claude appends where a skill comes from to its description: `(project)`, `(user)`, `(claude.ai sync)`,
// or puts a plugin's name first.
const sourceOf = (name: string, description: string): AgentCommand["source"] => {
  if (description.endsWith("(project)")) return "project"
  if (description.endsWith("(user)") || description.endsWith("(claude.ai sync)")) return "user"
  if (name.includes(":") || description.startsWith("(")) return "plugin"
  return "built-in"
}
const withoutSource = (description: string) =>
  description.replace(/\s*\((project|user|claude\.ai sync)\)$/, "").replace(/^\([^)]+\)\s*/, "")

const skill = (name: string, description: string, argumentHint: string | null = null) =>
  ({
    name,
    description: withoutSource(description),
    argumentHint,
    kind: "skill",
    source: sourceOf(name, description),
  }) as const
const command = (name: string, description: string, argumentHint: string | null = null) =>
  ({ name, description, argumentHint, kind: "command", source: null }) as const

export const COMMANDS: ReadonlyArray<AgentCommand> = [
  skill(
    "implement",
    "Implement a ticket or a spec end to end: branch, build test-first, review, pull request. (project)",
    "<issue>",
  ),
  skill(
    "code-review",
    "Review the changes since a fixed point along two axes: Standards and Spec. (project)",
    "[low|medium|high|xhigh|max|ultra] [--fix] [<pr#>|<branch>]",
  ),
  skill("tdd", "Test-driven development: red, green, refactor, with integration tests. (project)"),
  skill(
    "launch-ivin",
    "Launch ivin to show it to the user or to screenshot it yourself. (project)",
  ),
  skill("grilling", "Grill the user relentlessly about a plan, decision, or idea. (project)"),
  skill(
    "domain-modeling",
    "Build and sharpen a project's domain model: the glossary and the ADRs. (project)",
  ),
  skill(
    "prototype",
    "Build several genuinely different versions of a UI piece, behind a picker to flip through them live. (user)",
  ),
  skill(
    "review-animations",
    "Review animation and motion code against a high craft bar. Default to flagging; approval is earned. (user)",
  ),
  skill("retro", "Conduct a retrospective on a coding session. (user)"),
  skill(
    "teach",
    "Teach the user a new skill or concept, within this workspace. (user)",
    "What would you like to learn about?",
  ),
  skill(
    "learn-taste",
    "Turn a session's design corrections into rules, with their why, in DESIGN.md, a project skill, or a lint check. (user)",
  ),
  skill(
    "skill-creator:skill-creator",
    "(skill-creator) Create new skills, modify and improve existing skills, and measure skill performance.",
  ),
  skill(
    "simplify",
    "Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes.",
    "[<target>]",
  ),
  skill("loop", "Run a prompt or slash command on a recurring interval.", "[interval] [prompt]"),
  skill(
    "dataviz",
    "Use this skill whenever you are about to create any chart, graph, plot, dashboard, or data visualization.",
  ),
  skill(
    "security-review",
    "Complete a security review of the pending changes on the current branch.",
  ),
  command(
    "compact",
    "Clear conversation history but keep a summary in context.",
    "<optional custom summarization instructions>",
  ),
  command("clear", "Clear conversation history and free up context.", "[name]"),
  command("context", "Show what fills the context window, as a coloured grid."),
  command("model", "Set the model for this session.", "<model>"),
  command("effort", "Set the effort level for the model.", "<low|medium|high|xhigh|max|auto>"),
  command("init", "Initialize a new CLAUDE.md file with codebase documentation."),
  command("usage", "Show plan usage limits."),
  command("rename", "Rename the current conversation.", "[name]"),
  command("mcp", "Manage MCP servers.", "[reconnect|enable|disable [<server>|all]]"),
  command("review", "Review a pull request."),
  command("insights", "Generate a report analyzing your Claude Code sessions."),
  command("recap", "Summarize what happened in this session so far."),
]

export interface Ranked {
  readonly command: AgentCommand
  readonly matched: ReadonlyArray<number>
}

// The letters typed, in order, in the name: the tightest and earliest runs first, as Go to file ranks.
const match = (name: string, query: string): { score: number; at: number[] } | null => {
  if (query === "") return { score: 0, at: [] }
  const lower = name.toLowerCase()
  const q = query.toLowerCase()
  const start = lower.indexOf(q)
  if (start !== -1) {
    const at = Array.from(q, (_, i) => start + i)
    return { score: 1000 - start * 10 - (lower.length - q.length), at }
  }
  const at: number[] = []
  let from = 0
  for (const letter of q) {
    const i = lower.indexOf(letter, from)
    if (i === -1) return null
    at.push(i)
    from = i + 1
  }
  const spread = at[at.length - 1] - at[0]
  return { score: 500 - spread * 10 - at[0] * 5, at }
}

export const rank = (
  commands: ReadonlyArray<AgentCommand>,
  query: string,
): ReadonlyArray<Ranked> => {
  const scored = commands.flatMap((command) => {
    const found = match(command.name, query)
    return found ? [{ command, matched: found.at, score: found.score }] : []
  })
  if (query !== "") scored.sort((a, b) => b.score - a.score)
  return scored.map(({ command, matched }) => ({ command, matched }))
}

// The `/word` the caret is in when it starts the draft; null when the menu has nothing to do.
export const slashQuery = (text: string, caret: number): string | null => {
  if (!text.startsWith("/")) return null
  const token = /^\/\S*/.exec(text)![0]
  if (caret > token.length || caret < 1) return null
  return token.slice(1)
}

export const withPick = (text: string, name: string) => {
  const token = /^\/\S*/.exec(text)![0]
  const rest = text.slice(token.length).replace(/^ /, "")
  return `/${name} ${rest}`
}
