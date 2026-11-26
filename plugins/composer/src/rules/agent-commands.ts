import type { AgentCommand } from "@ivin/plugin-api/ui"

export interface RankedCommand {
  readonly command: AgentCommand
  // Positions in the name of the letters typed.
  readonly match: ReadonlyArray<number>
}

const GROUP = { project: 0, user: 1, plugin: 2, "built-in": 3 } as const
const groupOf = (command: AgentCommand) => (command.source === null ? 4 : GROUP[command.source])

// The query's letters in `text`, in order, from `from`; null if one is missing.
const lettersIn = (text: string, query: string, from: number): Array<number> | null => {
  const found: Array<number> = []
  for (const letter of query) {
    const at = text.indexOf(letter, from)
    if (at === -1) return null
    found.push(at)
    from = at + 1
  }
  return found
}

// The tightest run of the query's letters in `text`, trying each place its first letter appears.
const tightest = (text: string, query: string): Array<number> | null => {
  let best: Array<number> | null = null
  for (
    let start = text.indexOf(query[0] ?? "");
    start !== -1;
    start = text.indexOf(query[0] ?? "", start + 1)
  ) {
    const found = lettersIn(text, query, start)
    if (found === null) break
    if (best === null || spread(found) < spread(best)) best = found
  }
  return best
}

const spread = (found: ReadonlyArray<number>) => (found.at(-1) ?? 0) - (found[0] ?? 0)

// With no letters, the project's skills first, then the user's, the plugins', the built-in ones and the commands; with letters, the tightest and earliest run in the name first, as Go to file ranks.
export const rankCommands = (
  commands: ReadonlyArray<AgentCommand>,
  query: string,
): ReadonlyArray<RankedCommand> => {
  const letters = query.toLowerCase()
  if (letters === "")
    return [...commands]
      .sort((a, b) => groupOf(a) - groupOf(b))
      .map((command) => ({ command, match: [] }))
  return commands
    .flatMap((command) => {
      const match = tightest(command.name.toLowerCase(), letters)
      return match === null ? [] : [{ command, match }]
    })
    .sort(
      (a, b) =>
        spread(a.match) - spread(b.match) ||
        (a.match[0] ?? 0) - (b.match[0] ?? 0) ||
        a.command.name.length - b.command.name.length ||
        groupOf(a.command) - groupOf(b.command),
    )
}

const SOURCE_TAG = { user: "User skill", plugin: "Plugin skill", "built-in": "Built-in skill" }

export const commandTag = (command: AgentCommand, projectName: string) => {
  if (command.source === null) return "Command"
  if (command.source === "project")
    return `${projectName.charAt(0).toUpperCase()}${projectName.slice(1)} skill`
  return SOURCE_TAG[command.source]
}
