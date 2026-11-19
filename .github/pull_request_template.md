<!-- Title is a conventional commit: `<type>(<scope>): <subject>` -->
<!-- The reviewer reads the sections outside the collapsed block, and opens it only to check something. Fill a section once, in a line or two per point; never pad it. -->

- Closes #<issue> <!-- or Fixes #<issue>; Refs #<issue> for a related one -->
- Shares files with #<pr>: <!-- each open pull request that changes the same files, and which files. Delete the line when there is none. -->

## Summary

<!-- 2 or 3 sentences: what changes and why. When a ticket holds the detail, do not restate it. -->

## Risk of merging

<!-- Tells the reviewer how slowly to read. Be most careful before writing that a revert undoes it and little breaks: you are grading your own change. -->

**Undone by a revert:** <!-- Yes, or no and why. No: a SQLite schema or the shape of what is written to it; the format of a file the user edits in `~/.ivin` or `<repo>/.ivin`; deleting a worktree, a branch or a session; anything sent outside the machine. The plugin API is free to break while `apiVersion` is 0 (docs/architecture.md, API stability). -->

**What breaks if it is wrong:** <!-- What, and for whom. -->

**Not covered:** <!-- Risks that no test or check in this PR verifies. "None" when there is none. -->

## Read first

<!-- 2 to 5 places, in reading order, as `path:symbol`, each with one line on why a human should read it closely. -->

1.

## Decisions made here

<!-- Where the PR differs from what the ticket asked: each acceptance criterion met differently or left out, and each addition outside the ticket. Then each choice the ticket, the spec and the docs of record left open, with the option set aside, and each code-review finding left as it is, with why. "None" when there is none. -->

-

## Screenshots

<!-- Only when the PR changes a screen enough that a reviewer wants to see it: one or two captures, uploaded as the launch-ivin skill says. Delete this section otherwise. -->

## Test plan

<!-- Only the checks a test cannot do, by hand, step by step. A user-facing change follows docs/finished-features.md. -->

- [ ]

<details>
<summary>Code summary, evidence and files to skim</summary>

**Shape of the change:** <!-- The smallest view that shows it before the diff: pseudocode, a call tree, a component tree, a file tree, a Mermaid diagram, or a `diff` of one of these. Keep only the calls, files and boundaries a reviewer needs. -->

**Evidence:** <!-- The test that failed before and passes now, as pseudocode, or the output that changed. Delete when it would repeat the summary or the tests' names. -->

**Skim:** <!-- What follows mechanically from the Read first places: tests that mirror the code, renames, re-exports, docs. -->

</details>
