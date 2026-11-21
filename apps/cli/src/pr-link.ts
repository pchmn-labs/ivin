import { Annotation, prRelations, pullRequestUrlOf } from "@ivin/contracts/annotation"
import { Effect, Schema } from "effect"
import { type Command, type Input, UsageError } from "./command.ts"
import { annotateSession, sessionIdOf, sessionOption, stringOf } from "./session-annotation.ts"

const isRelation = (value: string | null): value is (typeof prRelations)[number] =>
  prRelations.some((relation) => relation === value)

const argumentsOf = (input: Input) => {
  const [text] = input.positionals
  if (text === undefined)
    return new UsageError({ message: "ivin pr link needs a pull request URL." })
  const url = pullRequestUrlOf(text)
  if (url === null) {
    return new UsageError({
      message: `"${text}" is not the URL of a GitHub pull request or a GitLab merge request. Expected https://<host>/<owner>/<repo>/pull/<number> or https://<host>/<group>/<project>/-/merge_requests/<number>.`,
    })
  }
  const relation = stringOf(input.values["as"])
  if (!isRelation(relation)) {
    return new UsageError({ message: "--as must be created, referenced or reviewed." })
  }
  const sessionId = sessionIdOf(input)
  if (sessionId instanceof UsageError) return sessionId
  return { url, relation, sessionId }
}

export const prLink: Command = {
  name: "pr link",
  summary: "Link a pull request to a session",
  usage: "ivin pr link <url> --as created|referenced|reviewed [--session <id>]",
  description:
    "Stores a pr annotation on a session, for a pull request or merge request the session's work created, mentions or reviewed. The session is the one whose agent runs the command, or --session outside one. Linking the same pull request again updates its relation.",
  options: {
    as: {
      type: "string",
      value: "relation",
      description: "created, referenced or reviewed",
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
      const { url, relation, sessionId } = parsed
      const annotation = yield* annotateSession(sessionId, "cli", "pr", { url, relation })
      return {
        ok: true,
        text: `Linked ${url} to session ${sessionId} as ${relation}.`,
        json: { annotation: Schema.encodeSync(Annotation)(annotation) },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
