import { Annotation, forgeLinkOf, forgeRelations } from "@ivin/contracts/annotation"
import { Effect, Schema } from "effect"
import { type Command, type Input, UsageError } from "./command.ts"
import { annotateSession, sessionIdOf, sessionOption, stringOf } from "./session-annotation.ts"

const kindNames = { pr: "a pull request", issue: "an issue" } as const

const argumentsOf = (input: Input) => {
  const [text] = input.positionals
  if (text === undefined) {
    return new UsageError({ message: "ivin link needs the URL of a pull request or an issue." })
  }
  const link = forgeLinkOf(text)
  if (link === null) {
    return new UsageError({
      message: [
        `"${text}" is not the URL of a pull request or an issue. Expected one of:`,
        "  https://<host>/<owner>/<repo>/pull/<number>",
        "  https://<host>/<owner>/<repo>/issues/<number>",
        "  https://<host>/<group>/<project>/-/merge_requests/<number>",
        "  https://<host>/<group>/<project>/-/issues/<number>",
      ].join("\n"),
    })
  }
  const relations: readonly string[] = forgeRelations[link.kind].filter((r) => r !== "branch")
  const relation = stringOf(input.values["as"])
  if (relation === null || !relations.includes(relation)) {
    const [first, second, third] = relations
    return new UsageError({
      message: `--as must be ${first}, ${second} or ${third} for ${kindNames[link.kind]}.`,
    })
  }
  const sessionId = sessionIdOf(input)
  if (sessionId instanceof UsageError) return sessionId
  return { ...link, relation, sessionId }
}

export const link: Command = {
  name: "link",
  summary: "Link a pull request or an issue to a session",
  usage: "ivin link <url> --as <relation> [--session <id>]",
  description:
    "Stores a pr or issue annotation on a session, depending on the URL: a GitHub pull request or issue, or a GitLab merge request or issue, on any host. A pull request is created, referenced or reviewed by the session's work; an issue is created, referenced or resolved. The session is the one whose agent runs the command, or --session outside one. Linking the same URL again updates its relation.",
  options: {
    as: {
      type: "string",
      value: "relation",
      description: "created, referenced, reviewed (pull request) or resolved (issue)",
    },
    session: sessionOption,
  },
  maxArguments: 1,
  check: (input) => {
    const parsed = argumentsOf(input)
    return parsed instanceof UsageError ? parsed : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const parsed = argumentsOf(input)
      if (parsed instanceof UsageError) return yield* parsed
      const { kind, url, relation, sessionId } = parsed
      const annotation = yield* annotateSession(sessionId, "cli", kind, { url, relation })
      return {
        ok: true,
        text: `Linked ${url} to session ${sessionId} as ${relation}.`,
        json: { annotation: Schema.encodeSync(Annotation)(annotation) },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
