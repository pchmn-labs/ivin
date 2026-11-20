import { Cause, Effect, Exit, Option } from "effect"
import { parseArgs } from "node:util"
import { type Command, commandHelp, exitCode, mainHelp, sharedOptions } from "./command.ts"
import { socketPathOf, withServer } from "./connection.ts"
import { doctor } from "./doctor.ts"

const commands: readonly Command[] = [doctor]

interface Outcome {
  readonly code: number
  readonly text: string
  readonly json: Record<string, unknown>
  readonly toStderr?: boolean
}

const failure = (code: number, reason: string, message: string, text = message): Outcome => ({
  code,
  text,
  json: { ok: false, error: { reason, message } },
  toStderr: true,
})

const usageError = (message: string, help: string) =>
  failure(exitCode.usage, "usage", message, `${message}\n\n${help}`)

const helpOf = (text: string): Outcome => ({
  code: exitCode.ok,
  text,
  json: { ok: true, help: text },
})

const parse = (command: Command, args: readonly string[]) => {
  try {
    return parseArgs({
      args: [...args],
      options: Object.fromEntries(
        Object.entries({ ...command.options, ...sharedOptions }).map(([key, { type }]) => [
          key,
          { type },
        ]),
      ),
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Node's message goes on about positionals that start with a dash.
    const unknown = /^Unknown option '([^']+)'/.exec(message)
    return usageError(unknown ? `Unknown option ${unknown[1]}.` : message, commandHelp(command))
  }
}

const run = async (args: readonly string[]): Promise<Outcome> => {
  const [name, ...rest] = args
  if (name === undefined) return usageError("ivin needs a command.", mainHelp(commands))
  if (name === "--help" || name === "-h") return helpOf(mainHelp(commands))
  const command = commands.find((candidate) => candidate.name === name)
  if (command === undefined) {
    return usageError(
      name.startsWith("-") ? `Unknown option ${name}.` : `Unknown command "${name}".`,
      mainHelp(commands),
    )
  }
  const parsed = parse(command, rest)
  if ("code" in parsed) return parsed
  const { values, positionals } = parsed
  if (values["help"] === true) return helpOf(commandHelp(command))
  if (positionals.length > command.arguments) {
    return usageError(
      `Unexpected argument "${positionals[command.arguments]}".`,
      commandHelp(command),
    )
  }

  const socketPath = socketPathOf(process.env)
  const exit = await Effect.runPromiseExit(
    withServer(socketPath, command.run({ values, positionals })),
  )
  if (Exit.isSuccess(exit)) {
    const { ok, text, json } = exit.value
    return { code: ok ? exitCode.ok : exitCode.failed, text, json: { ok, ...json } }
  }
  const error = Option.getOrUndefined(Cause.findErrorOption(exit.cause))
  if (error?._tag === "NotRunning") {
    return failure(
      exitCode.notRunning,
      "notRunning",
      `ivin is not running: nothing answers on ${socketPath}. Open the ivin app, then run the command again.`,
    )
  }
  if (error?._tag === "ConnectionFailed") {
    const { code } = error.cause as NodeJS.ErrnoException
    return failure(
      exitCode.failed,
      "failed",
      `Could not connect to ${socketPath}${code ? ` (${code})` : ""}.`,
    )
  }
  return failure(
    exitCode.failed,
    "failed",
    "ivin could not answer the command. The error is written in ivin's log, ~/.ivin/logs/ivin.log.",
  )
}

const args = process.argv.slice(2)
const outcome = await run(args)
const json = args.includes("--json")
const stream = outcome.toStderr && !json ? process.stderr : process.stdout
// Writes to a pipe are asynchronous on macOS: exiting before they drain would cut the output.
stream.write(`${json ? JSON.stringify(outcome.json) : outcome.text}\n`, () =>
  process.exit(outcome.code),
)
