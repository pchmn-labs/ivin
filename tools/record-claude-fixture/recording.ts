import { claudeArgs } from "../../packages/harness/src/modules/claude/rules/claude-args.ts"
import { approvalResponseLine } from "../../packages/harness/src/modules/claude/rules/control-response.ts"

export type LineTrigger = { type: string; subtype: string | null }
export type Wait = LineTrigger | { ms: number }
export type Action = { type: "send"; text: string } | { type: "interrupt" } | { type: "initialize" }
export type Step = { wait: Wait | null; action: Action }

export type Recording = {
  name: string
  steps: Step[]
  until: LineTrigger
  // A --wait after the last step: the end line counts only after it.
  untilWait: Wait | null
  keep: LineTrigger[]
  allow: string[]
  deny: string[]
  model: string
  effort: string
  permissionMode: string
  maxTurns: number
  timeoutMs: number
}

export const USAGE = `pnpm record:claude <fixture-name> [steps and options]

Runs Claude Code with the harness's arguments in a new temporary folder and
writes its stdout lines to packages/harness/src/modules/claude/rules/fixtures/<fixture-name>.jsonl.

Steps, sent in order:
  --send <text>          a user message
  --interrupt            an interrupt control request
  --initialize           the initialize control request
  --wait <trigger>       before the next step: <n>ms, or a line to see after the previous step;
                         after the last step, before the --until line counts

Triggers name a line by its type, and optionally its subtype (or stream event type,
or control request subtype): result, system/init, stream_event/content_block_delta,
control_request/can_use_tool.

Options:
  --until <trigger>      after the last step, end the run at this line (default: result)
  --keep <trigger>       write only the lines that match (repeatable; default: all)
  --allow <tool>         make the tool available and allow it when asked (repeatable)
  --deny <tool>          make the tool available and deny it when asked (repeatable)
  --model <model>        default: haiku
  --effort <effort>      default: low
  --permission-mode <m>  manual (default), plan or dontAsk
  --max-turns <n>        default: 4
  --timeout <seconds>    default: 120`

const VALUE_OPTIONS = new Set([
  "--send",
  "--wait",
  "--until",
  "--keep",
  "--allow",
  "--deny",
  "--model",
  "--effort",
  "--permission-mode",
  "--max-turns",
  "--timeout",
])

// acceptEdits and auto run tools without asking, so --allow would not decide.
const PERMISSION_MODES = new Set(["manual", "plan", "dontAsk"])

const FIXTURE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

const trigger = (value: string): LineTrigger => {
  const [type, subtype] = value.split("/", 2)
  return { type: type!, subtype: subtype ?? null }
}

const wait = (value: string): Wait => {
  const delay = /^(\d+)ms$/.exec(value)
  return delay ? { ms: Number(delay[1]) } : trigger(value)
}

const positive = (option: string, value: string): number | string => {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : `${option} takes a positive integer`
}

export const parseRecording = (argv: readonly string[]): Recording | string => {
  const [name, ...rest] = argv
  if (name === undefined || !FIXTURE_NAME.test(name))
    return `The first argument is the fixture name, in kebab-case.\n\n${USAGE}`
  const recording: Recording = {
    name,
    steps: [],
    until: { type: "result", subtype: null },
    untilWait: null,
    keep: [],
    allow: [],
    deny: [],
    model: "haiku",
    effort: "low",
    permissionMode: "manual",
    maxTurns: 4,
    timeoutMs: 120_000,
  }
  let pendingWait: Wait | null = null
  const step = (action: Action) => {
    recording.steps.push({ wait: pendingWait, action })
    pendingWait = null
  }
  for (let index = 0; index < rest.length; index++) {
    const option = rest[index]!
    if (option === "--interrupt") {
      step({ type: "interrupt" })
      continue
    }
    if (option === "--initialize") {
      step({ type: "initialize" })
      continue
    }
    const value = rest[++index]
    if (!option.startsWith("--") || !VALUE_OPTIONS.has(option))
      return `Unknown option: ${option}\n\n${USAGE}`
    if (value === undefined) return `${option} needs a value.`
    switch (option) {
      case "--send":
        step({ type: "send", text: value })
        break
      case "--wait":
        pendingWait = wait(value)
        break
      case "--until":
        recording.until = trigger(value)
        break
      case "--keep":
        recording.keep.push(trigger(value))
        break
      case "--allow":
        recording.allow.push(value)
        break
      case "--deny":
        recording.deny.push(value)
        break
      case "--model":
        recording.model = value
        break
      case "--effort":
        recording.effort = value
        break
      case "--permission-mode":
        if (!PERMISSION_MODES.has(value))
          return `${value} is refused: a recording runs only the tools given with --allow, so the mode is manual, plan or dontAsk.`
        recording.permissionMode = value
        break
      case "--max-turns": {
        const turns = positive(option, value)
        if (typeof turns === "string") return turns
        recording.maxTurns = turns
        break
      }
      case "--timeout": {
        const seconds = positive(option, value)
        if (typeof seconds === "string") return seconds
        recording.timeoutMs = seconds * 1000
        break
      }
    }
  }
  recording.untilWait = pendingWait
  if (recording.steps.length === 0) return `A recording needs at least one step.\n\n${USAGE}`
  return recording
}

export const claudeRecordingArgs = (recording: Recording): string[] => [
  ...claudeArgs(
    {
      model: recording.model,
      effort: recording.effort,
      permissionMode: recording.permissionMode,
    },
    null,
  ),
  "--tools",
  [...recording.allow, ...recording.deny].join(","),
  "--max-turns",
  String(recording.maxTurns),
  // The user's settings would bring their hooks, plugins and allow rules; the temporary folder has none.
  "--setting-sources",
  "project,local",
  "--strict-mcp-config",
]

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined

export const matches = ({ type, subtype }: LineTrigger, line: unknown): boolean => {
  if (field(line, "type") !== type) return false
  if (subtype === null) return true
  return [
    field(line, "subtype"),
    field(field(line, "event"), "type"),
    field(field(line, "request"), "subtype"),
  ].includes(subtype)
}

export const permissionAnswer = (recording: Recording, line: unknown): string | undefined => {
  const requestId = field(line, "request_id")
  if (!matches({ type: "control_request", subtype: "can_use_tool" }, line)) return undefined
  if (typeof requestId !== "string") return undefined
  const request = field(line, "request")
  const tool = field(request, "tool_name")
  const allow = typeof tool === "string" && recording.allow.includes(tool)
  return approvalResponseLine(requestId, allow, field(request, "input"))
}

const PLACEHOLDERS: Record<string, string> = { email: "user@example.com", organization: "example" }

const redactValue = (value: unknown, home: string): unknown => {
  if (typeof value === "string") return value.replaceAll(home, "~")
  if (Array.isArray(value)) return value.map((item) => redactValue(item, home))
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" && key in PLACEHOLDERS ? PLACEHOLDERS[key] : redactValue(item, home),
    ]),
  )
}

// Fixtures are public: Claude Code's initialize answer names the signed-in account.
export const redactLine = (text: string, home: string): string => {
  let line: unknown
  try {
    line = JSON.parse(text)
  } catch {
    return text.replaceAll(home, "~")
  }
  const redacted = redactValue(line, home)
  return JSON.stringify(redacted) === JSON.stringify(line) ? text : JSON.stringify(redacted)
}
