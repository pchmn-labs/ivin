import type { QuestionAnswer } from "@ivin/contracts/transcript"

const responseLine = (requestId: string, response: unknown): string =>
  JSON.stringify({
    type: "control_response",
    response: { subtype: "success", request_id: requestId, response },
  })

const deny = (message: string) => ({ behavior: "deny", message })

export const approvalResponseLine = (requestId: string, allow: boolean, input: unknown): string =>
  responseLine(
    requestId,
    allow ? { behavior: "allow", updatedInput: input } : deny("The user denied this tool use."),
  )

export const questionResponseLine = (
  requestId: string,
  input: unknown,
  answers: readonly QuestionAnswer[] | null,
): string =>
  responseLine(
    requestId,
    answers === null
      ? deny("The user declined to answer.")
      : {
          behavior: "allow",
          updatedInput: {
            ...(input as object),
            answers: Object.fromEntries(
              answers.map(({ question, choices }) => [question, choices.join(", ")]),
            ),
          },
        },
  )
