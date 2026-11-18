# approvals

The default rendering of tool approvals. While Claude waits, the `composer.above` slot (contribution `approvals/sheet`) docks an "Approval needed" sheet on the composer with the command and two options, Allow and Deny. ↑↓ choose, Enter answers, Esc denies, and the keys also work from the empty composer; the answer goes through `useAnswerApproval`, and a failed answer shows the host's message under the options, with Retry when the host says a second try can work. Once answered, the `transcript.approval` slot (contribution `approvals/default`) leaves a one-line record, "Allowed: <command>" or "Denied: <command>". The `approval-decision` and `approval-sheet` test ids are read by tests.

The harness answers an approval with allow or deny only, so there is no "Allow for this session" option, and Claude's `AskUserQuestion` has no sheet: both wait on an answer that carries more than a boolean.
