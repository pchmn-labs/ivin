# approvals

The default rendering of tool approvals, in the `transcript.approval` slot (contribution `approvals/default`). While Claude waits, it shows the tool, its input, and Allow and Deny buttons that call `useAnswerApproval`; once answered, it shows the decision. The `approval-allow`, `approval-deny` and `approval-decision` test ids are read by the end-to-end tests.
