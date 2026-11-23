---
name: ivin-customize
description: Use the `ivin` command to tell ivin, the app this session runs in, about the session's work and to read or change ivin's settings. Use when the session's work moves to another subject, to retitle the session; when the user asks to link a pull request, merge request or issue to this session; when you create, review, resolve or reference one; when you want to attach a fact to this session; when the user asks to change an ivin setting; or when an `ivin` command fails.
---

# The `ivin` command

ivin is the app that started this session. The `ivin` command on your `PATH` talks to it. Each command applies to your own session (`$IVIN_SESSION_ID`) unless you pass `--session <id>`; outside an ivin session, `--session` is required.

Every command takes `--help`, and `--json` to print `{ "ok": true, … }` or `{ "ok": false, "error": { "reason", "message" } }`. Exit codes: 0 ok, 1 failed, 2 invalid usage, 3 ivin is not running. Read the message of a failed command: it says what to fix.

## Give this session a title

```sh
ivin session rename "<title>"
```

ivin shows the title on the session's tab and in its sidebar, and names the session itself from the user's first message. Run it, without being asked, only when the work moves to another subject than that message's, not at each step.

Write a few words, under 60 characters, that name the work as the user would look for it among their tabs: `Fix tab drag reorder`, `Review PR #42: settings page`. No trailing period, no "Session about…". When the user named the session themselves, the command fails and says so: keep their title and do not retry.

## Link a pull request or an issue to this session

```sh
ivin link <url> --as <relation>
```

- `<url>` is a GitHub pull request or issue (`https://<host>/<owner>/<repo>/pull/<n>`, `…/issues/<n>`) or a GitLab merge request or issue (`https://<host>/<group>/<project>/-/merge_requests/<n>`, `…/-/issues/<n>`).
- `--as` says what this session's work did with it: `created`, `referenced` or `reviewed` for a pull request; `created`, `referenced` or `resolved` for an issue.

Run it, without being asked, when:

- the user asks to link a pull request, merge request or issue to this session ("link PR <url> to this session");
- you review a pull request: `--as reviewed`;
- the session's work is about a pull request or an issue you were pointed to, or one you mention as related: `--as referenced`;
- you create a pull request or an issue, whatever the means (`gh`, `glab`, an API call): `--as created`;
- the session's work fixes an issue: `--as resolved`.

Linking the same URL again updates its relation. ivin shows the linked pull requests and issues with the session.

## Attach another fact to this session

```sh
ivin session annotate --kind <kind> --data '<json>' [--ns <ns>]
```

An annotation is a typed piece of data on the session, which ivin and its plugins read. `--kind` names what it is (`note`, for instance), `--data` holds it as JSON, and `--ns` defaults to `cli`. Prefer `ivin link` for pull requests and issues: it checks the URL for you.

## Read or change ivin's settings

```sh
ivin settings get                       # every setting in use, one `path = value` line each
ivin settings get tabs.stopAgentOnClose # one setting
ivin settings set tabs.stopAgentOnClose false
```

The settings live in `~/.ivin/settings.json`, a JSON file with comments. Change them with `ivin settings set` rather than by editing the file: it checks the path and the value's type, keeps the file's comments, and ivin applies the change at once. The value is read as JSON, else as a string. An unknown path lists the known ones.

## When something fails

Run `ivin doctor`: one line per check (the app, its socket, the settings and keybindings files, this skill, the agent's program), exit 1 when one fails. Exit code 3 means ivin is not running, or that this session's ivin serves no socket: ask the user to open ivin.
