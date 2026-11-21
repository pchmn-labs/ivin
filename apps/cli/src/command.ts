import { Data, type Effect } from "effect"
import type { Server } from "./connection.ts"

export const exitCode = { ok: 0, failed: 1, usage: 2, notRunning: 3 } as const

// Exits 2, with the command's help.
export class UsageError extends Data.TaggedError("UsageError")<{ readonly message: string }> {}

// Exits 1, with `message` as the error.
export class CommandFailed extends Data.TaggedError("CommandFailed")<{
  readonly reason: string
  readonly message: string
}> {}

export interface Option {
  readonly type: "string" | "boolean"
  readonly short?: string
  readonly description: string
  readonly value?: string
}

export interface Result {
  readonly ok: boolean
  readonly text: string
  readonly json: Record<string, unknown>
}

export interface Input {
  readonly values: Readonly<Record<string, string | boolean | (string | boolean)[] | undefined>>
  readonly positionals: readonly string[]
  readonly env: NodeJS.ProcessEnv
}

export interface Command {
  readonly name: string
  readonly summary: string
  readonly usage: string
  readonly description: string
  readonly options: Readonly<Record<string, Option>>
  readonly maxArguments: number
  // Runs before connecting, so that invalid usage exits 2 even when ivin is not running.
  readonly check?: (input: Input) => UsageError | null
  readonly run: (input: Input) => Effect.Effect<Result, UsageError | CommandFailed, Server>
}

export const sharedOptions: Readonly<Record<string, Option>> = {
  json: { type: "boolean", description: "Print the result as JSON on stdout" },
  help: { type: "boolean", short: "h", description: "Show this help" },
}

const optionLines = (options: Readonly<Record<string, Option>>) => {
  const labels = Object.entries(options).map(([name, option]) => ({
    label: option.value ? `--${name} <${option.value}>` : `--${name}`,
    description: option.description,
  }))
  const width = Math.max(...labels.map(({ label }) => label.length))
  return labels.map(({ label, description }) => `  ${label.padEnd(width)}  ${description}`)
}

export const commandHelp = (command: Command) =>
  [
    `ivin ${command.name}: ${command.summary}`,
    "",
    `Usage: ${command.usage}`,
    "",
    command.description,
    "",
    "Options:",
    ...optionLines({ ...command.options, ...sharedOptions }),
  ].join("\n")

export const mainHelp = (commands: readonly Command[]) => {
  const width = Math.max(...commands.map(({ name }) => name.length))
  return [
    "ivin: talk to the running ivin app from a shell.",
    "",
    "Usage: ivin <command> [options]",
    "",
    "Commands:",
    ...commands.map(({ name, summary }) => `  ${name.padEnd(width)}  ${summary}`),
    "",
    "Every command takes --json, to print its result as JSON on stdout, and --help.",
    "Run `ivin <command> --help` for a command's options.",
    "Exit codes: 0 ok, 1 failed, 2 invalid usage, 3 ivin is not running.",
  ].join("\n")
}
