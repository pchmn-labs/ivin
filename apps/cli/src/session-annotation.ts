import { Effect } from "effect"
import type { Schema } from "effect"
import { CommandFailed, type Input, type Option, UsageError } from "./command.ts"
import { Server } from "./connection.ts"

export const stringOf = (value: Input["values"][string]) =>
  typeof value === "string" ? value : null

export const sessionOption: Option = {
  type: "string",
  value: "id",
  description: "The session (default: $IVIN_SESSION_ID)",
}

export const sessionIdOf = ({ values, env }: Input) => {
  const session = stringOf(values["session"])
  if (session === "") return new UsageError({ message: "--session needs a session id." })
  // An empty IVIN_SESSION_ID counts as unset.
  const sessionId = session ?? (env["IVIN_SESSION_ID"] || null)
  if (sessionId === null) {
    return new UsageError({ message: "--session <id> is required outside an ivin session." })
  }
  return sessionId
}

export const annotateSession = (sessionId: string, ns: string, kind: string, data: Schema.Json) =>
  Effect.gen(function* () {
    const { client } = yield* Server
    return yield* client["annotation.add"]({
      target: { _tag: "session", sessionId },
      ns,
      kind,
      data,
    }).pipe(
      Effect.catchTags({
        SessionNotFound: () =>
          Effect.fail(
            new CommandFailed({
              reason: "sessionNotFound",
              message: `No session has the id "${sessionId}".`,
            }),
          ),
        AnnotationDataInvalid: () =>
          Effect.fail(
            new UsageError({
              message: `The data does not have the shape of a ${kind} annotation.`,
            }),
          ),
        ProjectNotFound: Effect.die,
      }),
    )
  })
