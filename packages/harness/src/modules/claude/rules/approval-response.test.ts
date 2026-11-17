import { expect, test } from "vitest"
import { approvalResponseLine } from "./approval-response.ts"

test("allowing replies with the original input", () => {
  expect(JSON.parse(approvalResponseLine("r1", true, { command: "ls" }))).toEqual({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: "r1",
      response: { behavior: "allow", updatedInput: { command: "ls" } },
    },
  })
})

test("denying replies with a message", () => {
  expect(JSON.parse(approvalResponseLine("r1", false, { command: "ls" }))).toEqual({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: "r1",
      response: { behavior: "deny", message: "The user denied this tool use." },
    },
  })
})
