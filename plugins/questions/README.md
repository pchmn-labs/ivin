# questions

The agent's questions. While the agent waits on them, the `composer.above` slot (contribution `questions/sheet`) docks "The agent asks" on the composer, one question at a time under `Steps` naming each question. Its options are a `ChoiceList`: radio buttons for one choice, check boxes for several, and a last "Other" row answered in the user's own words. A pick moves to the next question, Continue or Enter confirms several, and the last question sends every answer through `useAnswerQuestion`; Esc or Decline declines them all. What the user picked is kept by request id, so it survives a session switch. A failed answer shows the host's message under the options, with Retry when the host says a second try can work.

Once answered, the `transcript.question` slot (contribution `questions/default`) shows "Asked N questions" and each question's header beside its answer, or "Declined the agent's questions". Questions whose turn or run ended first show "Not answered:" after a muted circle-alert, each question on its own bulleted line, then "The agent stopped while it waited, so it can no longer take your answers." The host's transcript leaves out the tool call that asked them. The `question-sheet` and `question-record` test ids are read by tests.

`rules/drafts.ts` turns the picks into answers and finds the next question to show.
