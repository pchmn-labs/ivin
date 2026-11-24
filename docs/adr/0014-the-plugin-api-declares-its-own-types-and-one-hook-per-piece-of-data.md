# The plugin API declares its own types and one hook per piece of data

`@ivin/plugin-api` declares every type that a hook, a slot prop or a `UiContext` member exposes (`Session`, `Tab`, `Project`, `Settings`, the transcript items given to the `transcript.*` slots, `Change`…) in its own `types.ts`. It re-exports none of `@ivin/contracts`, and its package no longer depends on it. The host hands plugins the contracts' objects, and a type test in the UI package fails when a contract type and its API type stop matching.

A piece of data has one hook, with a parameter for its variants: `useChanges(sessionId, kind)` for the uncommitted and the committed changes, `useOpenDiff()(sessionId, path, kind)`, `useDiffOnScreen(sessionId)` returning `{ path, kind }`, and `useGitStatus(sessionId)` returning the entries with their failure and retry. A hook that selects one item from a larger feed returns that item and re-renders only when it changes: `usePendingApproval` and `usePendingQuestion` replace `useTranscript`, which gave every plugin the whole item list. Hooks stay public ([ADR-0009](0009-the-window-frame-stays-in-the-app-and-its-features-are-plugins.md)).

## Why

- The API freezes as 1.0.0 at the switch. Types re-exported from the contracts would freeze the server's contracts with it.
- Codex and ACP will change the transcript. Plugins must read items through types that the host converts to, not through the server's.
- One hook per variant doubled the API for every feature with two modes, and a plugin that needs one item of the transcript should not re-render for every message.

## Considered options

- **Hooks reserved for built-in plugins**: rejected. It contradicts ADR-0009, and a user plugin could no longer replace a built-in one with `replaces`.
- **Keeping the contract re-exports**: rejected, for the freeze above.
- **Merging the composer's hooks** (`useSendMessage`, `useSendNow`, `useInterruptSession`…): rejected. They are different acts, not variants of one piece of data.

## Consequences

- The API types start with the shapes the contracts have today, and dates are `{ epochMilliseconds }`. A contract change is made in the contracts and in the host's conversion, not in the plugins.
- A host component that takes an API `Session` converts it back with `contractSession`, because the host is the only source of one.
