# A plugin declares the harness, exec and fetch calls it makes, and ivin refuses the others

A plugin's server half can change how agents are spawned (`ctx.harness.beforeSpawn`), run a program (`ctx.exec`) and reach a host (`ctx.fetch`). Nothing tells the user what a project plugin does when they trust it, and nothing stops a plugin from calling what it never meant to.

A plugin lists in the `permissions` of its manifest (the `ivin` key of its `package.json`) the `ctx` calls it makes:

```json
"permissions": {
  "harness": ["beforeSpawn"],
  "exec": ["gh", "git"],
  "fetch": ["api.github.com"]
}
```

- `harness` names hooks. It accepts no `"*"`: a plugin names each hook it takes.
- `exec` names programs, matched against the name as given to `ctx.exec`. A path (`./gh`, `/tmp/gh`) matches only when that exact path is declared.
- `fetch` names hosts. `*.github.com` matches the subdomains of `github.com`, not `github.com` itself, nor `github.com.evil.test`, nor `evilgithub.com`. A host is compared after the URL is parsed, and again after each redirect. The port is not part of the match.
- `exec` and `fetch` accept `"*"` for any program and any host. The trust prompt spells it out ("Runs any program", "Connects to any host") and lists it first.
- A manifest with no `permissions` declares none: the plugin's `ctx` refuses all three calls.

The check sits in one place, keyed by the `ctx` member, so a member added later declares its permission there. The plugin host checks `harness` and `exec`; the server checks `fetch`, so a UI half cannot skip it. The UI half's `ctx.fetch` goes through the server under the same `fetch` permission; the window's own `fetch` reaches no other origin, because the renderer's Content Security Policy (`default-src 'self'`) refuses it.

The permissions limit `ctx` only. A server half is Node code and can import `node:fs` or `node:net`: ivin says "Runs code on your machine with your rights" for a plugin with a server half, and never words a permission as a limit on the plugin's code. `ctx.commands.run` calls another plugin's command, which runs with that plugin's permissions.

## Considered options

- **`fs` and server-side `net` permissions**: rejected because a server half can reach the file system and the network without `ctx`, so a permission would promise a limit nothing enforces.
- **A process per plugin under Node's permission model**: rejected because it multiplies the plugin host's processes and memory for a limit that still leaves `child_process` behind a flag.
- **Refusing `node:` imports at compile time**: rejected because a dependency can reach the same modules, and a check on import names is evaded by a dynamic import.
- **Naming the permission `net`**: rejected because it reads as raw sockets; the permission covers `ctx.fetch` and hosts only.

## Consequences

- Built-in plugins declare the permissions they use; a plugin with none (all of today's) declares none.
- A change of a trusted project plugin's permissions changes its content hash, so it will ask for trust again.
