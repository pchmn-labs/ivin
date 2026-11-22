import { expect, test } from "vitest"
import { approvalResponseLine, questionResponseLine } from "./control-response.ts"

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

const questions = {
  questions: [
    { question: "Colour?", header: "Colour", options: [], multiSelect: false },
    { question: "Fruits?", header: "Fruits", options: [], multiSelect: true },
  ],
}

test("answering questions allows the tool with each question's choices, joined by commas", () => {
  const answers = [
    { question: "Colour?", choices: ["Green, like grass"] },
    { question: "Fruits?", choices: ["Apple", "Plum"] },
  ]

  expect(JSON.parse(questionResponseLine("r1", questions, answers))).toEqual({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: "r1",
      response: {
        behavior: "allow",
        updatedInput: {
          ...questions,
          answers: { "Colour?": "Green, like grass", "Fruits?": "Apple, Plum" },
        },
      },
    },
  })
})

test("declining questions denies the tool", () => {
  expect(JSON.parse(questionResponseLine("r1", questions, null)).response.response).toEqual({
    behavior: "deny",
    message: "The user declined to answer.",
  })
})
