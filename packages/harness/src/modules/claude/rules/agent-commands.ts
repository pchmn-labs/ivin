import type { AgentCommand } from "@ivin/contracts/session"
import * as Schema from "effect/Schema"
import { ControlResponse } from "./initialize.ts"

const CommandEntry = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  argumentHint: Schema.optional(Schema.String),
  // Absent on the user's, the project's and the plugins' skills and commands.
  builtin: Schema.optional(Schema.Boolean),
})
export type CommandEntry = typeof CommandEntry.Type

const CommandList = Schema.Struct({ commands: Schema.Array(Schema.Unknown) })

const RunInitLine = Schema.Struct({
  type: Schema.Literal("system"),
  subtype: Schema.Literal("init"),
  slash_commands: Schema.Array(Schema.String),
  skills: Schema.optional(Schema.Array(Schema.String)),
  terminal_slash_commands: Schema.optional(Schema.Array(Schema.String)),
})

// What only a run's first line says: which built-in commands are skills, and which work only in Claude's terminal.
export interface CommandFacts {
  readonly skills: ReadonlySet<string>
  readonly terminalOnly: ReadonlySet<string>
}

// Recorded from Claude Code 2.1, until a run reports its own list.
export const initialFacts: CommandFacts = {
  skills: new Set(),
  terminalOnly: new Set(["doctor", "color", "focus", "reload-plugins"]),
}

// A `__` name is one of Claude's internal commands.
const isOffered = (name: string, facts: CommandFacts) =>
  !name.startsWith("__") && !facts.terminalOnly.has(name)

// Undefined: the line is not the response to `requestId`.
export const commandEntriesFromInitialize = (
  line: unknown,
  requestId: string,
): CommandEntry[] | undefined => {
  const control = Schema.decodeUnknownOption(ControlResponse)(line)
  if (control._tag === "None" || control.value.response.request_id !== requestId) return undefined
  const list = Schema.decodeUnknownOption(CommandList)(control.value.response.response)
  if (list._tag === "None") return []
  return list.value.commands.flatMap((entry) => {
    const decoded = Schema.decodeUnknownOption(CommandEntry)(entry)
    return decoded._tag === "None" ? [] : [decoded.value]
  })
}

export const agentCommands = (
  entries: readonly CommandEntry[],
  facts: CommandFacts,
): AgentCommand[] =>
  entries
    .filter((entry) => isOffered(entry.name, facts))
    .map((entry) => ({
      name: entry.name,
      description: entry.description,
      argumentHint: entry.argumentHint || null,
      kind: entry.builtin !== true || facts.skills.has(entry.name) ? "skill" : "command",
    }))

// Undefined: the line is not a run's first line.
export const commandsOfRun = (
  line: unknown,
): { readonly names: readonly string[]; readonly facts: CommandFacts } | undefined => {
  const init = Schema.decodeUnknownOption(RunInitLine)(line)
  if (init._tag === "None") return undefined
  const facts: CommandFacts = {
    skills: new Set(init.value.skills ?? []),
    terminalOnly: new Set(init.value.terminal_slash_commands ?? []),
  }
  return { names: init.value.slash_commands.filter((name) => isOffered(name, facts)), facts }
}

export const sameNames = (listed: readonly AgentCommand[], names: readonly string[]) => {
  const known = new Set(listed.map((command) => command.name))
  return known.size === new Set(names).size && names.every((name) => known.has(name))
}
