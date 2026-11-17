# AGENTS.md

## Agent skills

### Design of record

`docs/architecture.md` is the design the code follows. Read it before exploring an area, and a change that departs from it updates it in the same PR.

### Branching

One branch per change, cut from a fresh `origin/main` and named `<type>/<slug>`, where `<type>` is the conventional-commit type of the work. Start it in its own git worktree under `.worktrees/`, named after the branch with `/` as `-`, never by switching branches in the main checkout: another session may be working there.

### Pull requests

One PR per change, opened against `main`. Its title is a conventional commit, `<type>(<scope>): <subject>`.

Everything written to the repo and the tracker is in English, whatever the language of the conversation: code, commits, docs, PR titles and bodies, comments.

### Design

Motion goes through the `animate` and `choreograph` skills, not `impeccable animate`. A new UI dependency goes through `pick-ui-library` first.

### Code comments

Write them in English, on the exact line they protect: one line by default, two only if each carries a fact of its own. A comment states something the code cannot (a constraint, a gotcha, a why), never a paraphrase of the line below it. Design rationale belongs in `docs/architecture.md` or an ADR, and nothing written there is repeated in a comment. When in doubt, delete.
