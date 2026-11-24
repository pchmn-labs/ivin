# Plugin dependencies are installed from the plugin's lockfile by the pnpm ivin ships

A plugin lists npm packages in the `dependencies` of its `package.json`, and their versions in a `pnpm-lock.yaml` beside it, written by `ivin plugin lock <id>`. Before compiling the plugin, the server installs them with pnpm 11, which ships inside the app and runs with the app's own Node (Electron's binary with `ELECTRON_RUN_AS_NODE`), so nothing comes from the user's `PATH`. The install runs `pnpm install --frozen-lockfile --ignore-scripts` on a copy of the dependencies and the lockfile, in a temporary folder that is then renamed to `~/.ivin/cache/plugins/deps/<hash>`, the hash covering pnpm's version, the dependencies and the lockfile. Plugins with the same dependencies and lockfile share one install, and a plugin whose bundle is cached installs nothing. pnpm's store is `~/.ivin/cache/pnpm-store`.

Rolldown resolves the plugin's own imports of its dependencies from that folder, never from the plugin's own `node_modules`, and resolves the dependencies' imports from where pnpm placed them. `react`, `react-dom` and `@ivin/plugin-api` resolve to the window's instances before any of that, whoever imports them. A dependency that ships or builds a native module (`binding.gyp`, a `.node` file) fails the plugin, since a UI half runs in the window.

pnpm 11 rather than 12: pnpm 12 runs only as a native executable per platform (48 MB on macOS arm64, 65 MB on Linux x64), which would sit outside the asar archive and be signed with the app; its JavaScript entry only downloads that executable. pnpm 11 is JavaScript, 24 MB, with no dependencies, and installs from a lockfile written by pnpm 12 (both write lockfile version 9).

## Considered options

- **Reading the plugin's own `node_modules`**: rejected because what an author or an agent leaves there, or edits by hand, would change the loaded plugin without changing its lockfile, and native modules built for the author's Node would slip in.
- **Bundling by the author**: rejected because it makes every plugin carry a build step, and its React would be a copy unless the author knew to mark it external.
- **The user's own `npm` or `pnpm`**: rejected because an app opened from the Dock has no `PATH` to it, many users have neither, and their versions differ.
- **Shipping npm**: rejected because pnpm's store shares files between plugins and its lockfile pins the whole tree.
- **Install scripts**: rejected because they run arbitrary code at install time, outside any approval, and a UI half has no use for what they usually build.
- **pnpm 12's executable**: rejected for its size per platform and the extra binary to sign, as above.

## Consequences

- A `file:` dependency must be an absolute path: the dependencies are installed and locked outside the plugin's folder.
- The plugin's other `package.json` fields (`peerDependencies` on `@ivin/plugin-api`, `devDependencies`) are not installed. Missing peers of a dependency are not installed either: `react` and `react-dom` come from the window.
- Upgrading the shipped pnpm to a major that changes the lockfile format needs a check that it still installs lockfiles written by the previous one.
- Reopen this choice when pnpm 11 stops receiving fixes, or when ivin is signed and distributed: the executable's size and signing are then the cost of staying current.
