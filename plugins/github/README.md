# github

The built-in plugin that knows GitHub. Its server half (`src/server.ts`) finds each session's pull requests and writes them as `pr` annotations in namespace `github`; the `prs` plugin shows them. Its UI half is the settings section where each project picks its `gh` account.

## Where a session's PRs come from

- **Branch PR**: on a session's creation and when its branch changes (the last looked-up branch per session is in `storage` as `branch:<sessionId>`), `gh repo view` then `gh pr list --head <branch>`; the main branch and a null branch have none, and a fork's PR is left out (`rules/branch-pr.ts`). Relation `branch`.
- **Created PRs**: `transcript.onEvent` remembers a `tool_call` that holds `gh pr create` or whose tool name ends with `create_pull_request`, and on its non-error `tool_result` attaches every PR URL in the output (`rules/created-prs.ts`). Relation `created`.
- **Citations**: the `citation` annotations of namespace `ivin` become a `pr` or `issue` annotation with relation `referenced` (`gh api repos/<repo>/issues/<n>`; a `pull_request` field means a PR). Done ones are in `storage` as `citations:<sessionId>`.
- **Links from elsewhere**: the sweep poll lists every `pr` annotation of every namespace (`ivin link` writes in `cli`) and polls their status.

## Poll keys

- `github:sweep`, every 60 s: branch lookups that did not finish, citations, and starting a status poll for each GitHub PR not merged or closed.
- `github:pr:<url>`, one per PR whatever the number of sessions holding it: `gh pr view`, every 3 min, every 45 s while checks are pending. It stops once the PR is merged or closed, and when no session holds the URL any more (the user removed it from the card); the sweep does not restart a merged or closed one.

A failed check stores a plain message in `error` next to the last known fields (`rules/gh-failure.ts`); the next success removes it.

## Commands and accounts

`github.accounts`, `github.projectAccount`, `github.setProjectAccount`, run from the UI half with `useRunServerCommand`. A project's account is the repo's local git config `ivin.githubUser`. With one set, every `gh` call for the project's sessions runs with `GH_TOKEN` from `gh auth token --user <login>` (cached 5 minutes), and `harness.beforeSpawn` gives the agent the same `GH_TOKEN`.

## Tests

`src/server.test.ts` drives the server half through the fake `ctx` of `src/test-ctx.ts` (scripted `gh`/`git` output by command prefix, a poll registry that `tick` runs, in-memory annotations and storage). `src/rules/fixtures/` holds real `gh` 2.98.0 output (`auth-status`, `repo-view`, `pr-view-merged`, `pr-list`); `gh auth status` prints on stdout in that version and on stderr in older ones, and the parser reads both.
