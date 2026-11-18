# Code layout: `packages/ui`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
packages/ui/src/
  app/                  the entry point: window shell, layout, slot renderer; composes the modules' ui/
  modules/<subject>/
    rules/              pure: no React, atom, RPC client or adapter
    atoms/              the subject's atoms, fed by RPC streams, and one Atom.fn per RPC mutation
    hooks/              what needs a mounted component: use- in the filename and in every export
    adapters/           browser APIs and stores outside the RPC: clipboard, local storage, drag and drop
    ui/                 components
  core/
    ui/<component>/     design system: <component>.tsx, <component>.css, its test
    theme/              the --iv- tokens and base styles
    server-client.ts    the RPC client service
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no mock and no `await` |
| `atoms/` | a test reads it in an atom registry with a fake RPC client, no component mounted |
| `hooks/` | a test needs a mounted component |
| `adapters/` | a test needs the real browser API |
| `ui/` | a test needs a renderer |

- An atom reaches the server through the RPC client service in `core/`, never through `adapters/`.
- A mutation atom is named for the server use case it calls: `atoms/rename-session.ts` for `usecases/rename-session.ts`.
- A module has the server's name for the subject.
- A file that needs a mock to reach one of its functions holds two layers: split it.
- A component's styles live in a `.css` file beside it, with `iv-` classes and `--iv-` tokens only; no inline `style`. A screen in `modules/<subject>/ui/` does the same.

## Tests

- `rules/`: called directly.
- `atoms/`: in an atom registry, with a fake RPC client.
- `hooks/` and `ui/`: Vitest browser mode, with the same fake RPC client.
