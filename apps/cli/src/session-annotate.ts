import { Annotation } from "@ivin/contracts/annotation"
import { Effect, Schema } from "effect"
import { type Command, type Input, UsageError } from "./command.ts"
import { annotateSession, sessionIdOf, sessionOption, stringOf } from "./session-annotation.ts"

const argumentsOf = (input: Input) => {
  const { values } = input
  const kind = stringOf(values["kind"])
  if (kind === null || kind === "") return new UsageError({ message: "--kind <kind> is required." })
  const text = stringOf(values["data"])
  if (text === null) return new UsageError({ message: "--data <json> is required." })
  let data: Schema.Json
  try {
    data = JSON.parse(text) as Schema.Json
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return new UsageError({ message: `--data is not valid JSON: ${reason}` })
  }
  const ns = stringOf(values["ns"]) ?? "cli"
  if (ns === "") return new UsageError({ message: "--ns needs a namespace." })
  const sessionId = sessionIdOf(input)
  if (sessionId instanceof UsageError) return sessionId
  return { kind, data, ns, sessionId }
}

export const sessionAnnotate: Command = {
  name: "session annotate",
  summary: "Attach an annotation to a session",
  usage: "ivin session annotate --kind <kind> --data <json> [--ns <ns>] [--session <id>]",
  description:
    "Stores typed metadata on a session, for plugins to read. The session is the one whose agent runs the command, or --session outside one. Writing a kind that defines a key again with the same key updates its annotation.",
  options: {
    kind: { type: "string", value: "kind", description: "The annotation's kind, such as note" },
    data: { type: "string", value: "json", description: "The annotation's data, as JSON" },
    ns: { type: "string", value: "ns", description: "The annotation's namespace (default: cli)" },
    session: sessionOption,
  },
  maxArguments: 0,
  check: (input) => {
    const parsed = argumentsOf(input)
    return parsed instanceof UsageError ? parsed : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const parsed = argumentsOf(input)
      if (parsed instanceof UsageError) return yield* parsed
      const { kind, data, ns, sessionId } = parsed
      const annotation = yield* annotateSession(sessionId, ns, kind, data)
      return {
        ok: true,
        text: `Added ${ns}/${kind} annotation ${annotation.id} to session ${sessionId}.`,
        json: { annotation: Schema.encodeSync(Annotation)(annotation) },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
