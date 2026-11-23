import type { CitationAnnotationData } from "@ivin/contracts/annotation"
import * as Schema from "effect/Schema"

const MESSAGE_LIMIT = 4_000
const TITLE_LIMIT = 60

const PROMPT = `You write the title of a coding session from the user's first message, and spot the issue or pull request it is about.
Return JSON with exactly two keys: title and workItem.
workItem is null or an object with exactly two keys: kind ("issue" or "pr") and number (a positive integer copied from the user message).
Never invent a work item number. If the reference is ambiguous or has no number, return null.
Do not call tools. Reply with JSON only.

Before answering, silently reduce the request to:
- Subject: what system, feature, or problem is this really about?
- Outcome: what does the user ultimately want to understand or change?
- Incidental instructions: what only describes how the agent should do the work?

Title the subject and outcome. Discard incidental instructions.

Editorial rules:
- 3-8 words, fewer than 40 characters, in the language of the message.
- A compact noun phrase or a clear action phrase.
- Capture the umbrella goal when the request lists several symptoms or steps.
- Name the product change, not the mock, plan, report, branch, or pull request used to produce it.
- Slash commands, models, subagents, tools, and output formats do not belong in the title unless they are themselves the topic.
- Do not claim the work is complete.
- Do not copy and truncate the user's message.
- No quotes, labels, filler, or trailing punctuation.`

export const firstMessagePrompt = (text: string): string =>
  `${PROMPT}\n\nUser message:\n${text.length > MESSAGE_LIMIT ? `${text.slice(0, MESSAGE_LIMIT)}…` : text}`

export interface FirstMessageReading {
  readonly title: string | null
  readonly citation: CitationAnnotationData | null
}

const Reply = Schema.Struct({
  title: Schema.String,
  workItem: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        kind: Schema.Literals(["issue", "pr"]),
        number: Schema.Int.check(Schema.isGreaterThan(0)),
      }),
    ),
  ),
})

const decodeReply = Schema.decodeUnknownOption(Schema.fromJsonString(Reply))

const titleOf = (raw: string): string | null => {
  const line = (raw.trim().split(/\r?\n/)[0] ?? "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\.+$/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
  if (line === "") return null
  return line.length > TITLE_LIMIT ? `${line.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : line
}

const holdsNumber = (text: string, number: number) =>
  new RegExp(`(^|\\D)${number}(?=\\D|$)`).test(text)

const nothing: FirstMessageReading = { title: null, citation: null }

export const readingOf = (reply: string, message: string): FirstMessageReading => {
  // Models wrap JSON in a code fence or a sentence despite being told not to.
  const start = reply.indexOf("{")
  const end = reply.lastIndexOf("}")
  if (start === -1 || end < start) return nothing
  const decoded = decodeReply(reply.slice(start, end + 1))
  if (decoded._tag === "None") return nothing
  const title = titleOf(decoded.value.title)
  if (title === null) return nothing
  const item = decoded.value.workItem ?? null
  return {
    title,
    citation: item !== null && holdsNumber(message, item.number) ? item : null,
  }
}
