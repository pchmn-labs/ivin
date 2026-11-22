import { expect, test } from "vitest"
import type { Question } from "@ivin/plugin-api/ui"
import { OTHER, answersOf, choicesOf, emptyDrafts, isAnswered, nextStep } from "./drafts.ts"

const question = (text: string, labels: string[], multiSelect = false): Question => ({
  question: text,
  header: text,
  options: labels.map((label) => ({ label, description: "" })),
  multiSelect,
})

const runner = question("Runner?", ["Vitest", "Jest"])
const folders = question("Folders?", ["src/a", "src/b", "src/c"], true)

test("the choices are the picked labels in option order, then the user's own text", () => {
  expect(choicesOf(folders, { selected: [OTHER, "2", "0"], other: "  docs  " })).toEqual([
    "src/a",
    "src/c",
    "docs",
  ])
})

test("Other with no text answers nothing", () => {
  expect(choicesOf(runner, { selected: [OTHER], other: " " })).toEqual([])
  expect(isAnswered(runner, { selected: [OTHER], other: "" })).toBe(false)
})

test("the answers pair each question's text with its choices", () => {
  expect(
    answersOf(
      [runner, folders],
      [
        { selected: ["1"], other: "" },
        { selected: ["0", "1"], other: "" },
      ],
    ),
  ).toEqual([
    { question: "Runner?", choices: ["Jest"] },
    { question: "Folders?", choices: ["src/a", "src/b"] },
  ])
})

test("after a question comes the next one; after the last, the first left unanswered, or sending", () => {
  const questions = [runner, folders]
  const drafts = emptyDrafts(questions)

  expect(nextStep(questions, drafts, 0)).toBe(1)
  expect(nextStep(questions, drafts, 1)).toBe(0)
  expect(
    nextStep(
      questions,
      [
        { selected: ["0"], other: "" },
        { selected: ["2"], other: "" },
      ],
      1,
    ),
  ).toBe("send")
})
