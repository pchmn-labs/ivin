import { Effect } from "effect"
import { CommandFailed, type Command, type Input, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { sessionIdOf, sessionNotFound, sessionOption } from "./session-annotation.ts"

const argumentsOf = (input: Input) => {
  const title = input.positionals[0]?.trim() ?? ""
  if (title === "") return new UsageError({ message: "ivin session rename needs a title." })
  const sessionId = sessionIdOf(input)
  if (sessionId instanceof UsageError) return sessionId
  return { title, sessionId }
}

export const sessionRename: Command = {
  name: "session rename",
  summary: "Give a session a title that names its work",
  usage: "ivin session rename <title> [--session <id>]",
  description:
    "Sets the title ivin shows on the session's tab and in the sidebar. The session is the one whose agent runs the command, or --session outside one. A title the user gave the session stays: the command then changes nothing and fails.",
  options: { session: sessionOption },
  maxArguments: 1,
  check: (input) => {
    const parsed = argumentsOf(input)
    return parsed instanceof UsageError ? parsed : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const parsed = argumentsOf(input)
      if (parsed instanceof UsageError) return yield* parsed
      const { title, sessionId } = parsed
      const { client } = yield* Server
      const session = yield* client["session.rename"]({ sessionId, title, by: "agent" }).pipe(
        Effect.catchTags({
          SessionNotFound: () => sessionNotFound(sessionId),
          SessionTitleChosenByUser: () =>
            Effect.fail(
              new CommandFailed({
                reason: "titleChosenByUser",
                message: "The user named this session, so its title stays as it is.",
              }),
            ),
        }),
      )
      return {
        ok: true,
        text: `Renamed session ${sessionId} to "${session.title}".`,
        json: { title: session.title },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
