import type { Question, QuestionAnswer } from "@ivin/plugin-api/ui"

export const OTHER = "other"

// The options picked by their index, as strings, and `OTHER` for the user's own text.
export interface Draft {
  readonly selected: ReadonlyArray<string>
  readonly other: string
}

export const emptyDrafts = (questions: ReadonlyArray<Question>): Draft[] =>
  questions.map(() => ({ selected: [], other: "" }))

export const choicesOf = (question: Question, draft: Draft): string[] => {
  const labels = question.options.flatMap((option, index) =>
    draft.selected.includes(String(index)) ? [option.label] : [],
  )
  const own = draft.other.trim()
  return draft.selected.includes(OTHER) && own !== "" ? [...labels, own] : labels
}

export const isAnswered = (question: Question, draft: Draft) =>
  choicesOf(question, draft).length > 0

export const answersOf = (
  questions: ReadonlyArray<Question>,
  drafts: ReadonlyArray<Draft>,
): QuestionAnswer[] =>
  questions.map((question, index) => ({
    question: question.question,
    choices: choicesOf(question, drafts[index]!),
  }))

// Where to go once `from` is answered: the next question, the first one left unanswered, or sending.
export const nextStep = (
  questions: ReadonlyArray<Question>,
  drafts: ReadonlyArray<Draft>,
  from: number,
): number | "send" => {
  if (from < questions.length - 1) return from + 1
  const unanswered = questions.findIndex((question, index) => !isAnswered(question, drafts[index]!))
  return unanswered === -1 ? "send" : unanswered
}
