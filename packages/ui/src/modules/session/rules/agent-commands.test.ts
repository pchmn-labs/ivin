import { expect, test } from "vitest"
import { agentCommandsFailure } from "./agent-commands.ts"

test("a failed listing names the harness, says the message still sends, and offers a retry", () => {
  expect(agentCommandsFailure("Claude")).toEqual({
    text: "Could not load Claude's skills and commands. The message still sends as typed.",
    retryable: true,
  })
})
