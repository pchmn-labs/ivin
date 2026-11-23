# ivin asks the user to trust a project folder before it runs git or an agent in it

A repository's own `.git/config` can name commands that git runs for ivin: a clean filter on a status, merge drivers, hooks, and `core.sshCommand`, `uploadpack`, `protocol.ext` or a `!` credential helper on a fetch. A folder copied or extracted with its `.git` folder can carry them; a plain clone cannot. An agent has the same problem: ivin starts Claude Code with `-p`, which skips Claude Code's own trust question, so the folder's `.claude/settings.json` hooks and MCP servers would run without asking.

So ivin runs neither git nor a session in a folder until the user trusts the project it belongs to (a **Trusted project**). The first opening asks, and the server, not only the UI, refuses git and session starts in any other folder, so a forgotten call path is refused instead of running git. The trust covers the project's worktrees, wherever they are, and is not tied to a fingerprint of `.git/config`: a trusted project is never asked again.

In every repository, trusted or not, ivin also overrides the settings whose commands nothing ivin does needs:

- `core.fsmonitor=false` on every command, and `--no-ext-diff --no-textconv` on every diff;
- `core.hooksPath=/dev/null` on reads (status, diff, log, rev-parse, ls-files, merge-base, patch-id…). A commit, a checkout or a merge the user asked for keeps the repository's hooks, as git itself would;
- `protocol.ext.allow=never` on every fetch.

## Considered options

- **Overriding `filter.*`**: rejected because it would break Git LFS, whose clean filter makes a status show the right changes.
- **Overriding `core.sshCommand` and `credential.helper`**: rejected because in a trusted repository they come from the user's own setup, and a fetch needs them.
- **Asking again when `.git/config` changes**: rejected because ivin, the agent and the user change it all the time; once trusted, the folder's config is the user's.
- **Gating git only**: rejected because the agent runs the folder's own hooks and servers too, so an untrusted folder would still run commands as soon as a session starts.

## Consequences

- The projects saved before this decision were trusted by the migration that added the trust, since ivin had already run git in them.
- Withdrawing trust is not possible yet.
