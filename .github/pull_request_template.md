<!-- Title is a conventional commit: `<type>(<scope>): <subject>` -->
<!-- Fill a section in a line or two per point; delete a section that would only say "none". -->

- Closes #<issue> <!-- or Fixes #<issue>; Refs #<issue> for a related one -->

## Summary

<!-- 2 or 3 sentences: what changes and why. When a ticket holds the detail, do not restate it. -->

## Risk of merging

<!-- Tells the reviewer how slowly to read. Be most careful before writing that a revert undoes it and little breaks: you are grading your own change. -->

**Undone by a revert:** <!-- Yes, or no and why. No: a SQLite schema or the shape of what is written to it; the format of a file the user edits in `~/.ivin` or `<repo>/.ivin`; deleting a worktree, a branch or a session; anything sent outside the machine. The plugin API is free to break while `@ivin/plugin-api` is at 0.x (docs/architecture/README.md, API stability). -->

**What breaks if it is wrong:** <!-- What, and for whom. -->

## Decisions to check

<!-- Only what the reviewer may want to refuse: an acceptance criterion met differently or left out, an addition outside the ticket, a choice that changes what the user sees, a code-review finding left as it is (with why). -->

-

## Screenshots

<!-- Captures of a change on screen, uploaded as the launch-ivin skill says. -->

## Test plan

<!-- Only the checks a test cannot do, by hand, step by step. -->

- [ ]
