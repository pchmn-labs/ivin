# A project plugin runs only content the user trusted, unless the project has full trust

A project's `.ivin/plugins/` sits in the agent's working folder. An agent allowed to edit files, or a `git pull`, could turn a file write into code that runs in ivin outside the harness's approvals.

So a plugin of a trusted project runs only a version whose content hash the user trusted. A plugin never trusted does not run. After a file changes, the trusted version keeps running from a copy kept in `~/.ivin/cache/plugin-trust/`, and the user is asked again with the change shown. Trusting the project folder ([ADR-0010](0010-ivin-asks-the-user-to-trust-a-project-folder-before-running-git-or-an-agent-in-it.md)) does not trust its plugins.

A project can instead have **full trust**, off by default and set by the user for that project: a change to its plugins runs at once, and the Plugins page lists each change with its diff, without blocking. Full trust never covers a change to the manifest's `permissions` ([ADR-0011](0011-a-plugin-declares-the-harness-exec-and-fetch-calls-it-makes.md)): that asks again. Safe mode ignores it.

## Considered options

- **Ask again at every change, with no way out**: rejected because a plugin the team edits often would ask all day, and users would approve without reading.
- **Trust the repository once**: rejected because a `git pull` would then run new code with no question; full trust is that choice, made on purpose for a project the user controls.
- **Trust what is committed and ask only for the working tree**: rejected because a pull is what brings the code.

## Consequences

- Turning full trust on runs the plugins that wait in that project at once, except those whose permissions changed.
- Old copies of trusted versions are not deleted yet.

## Revisit if

Users keep full trust on for every project, which would make the question not worth asking.
