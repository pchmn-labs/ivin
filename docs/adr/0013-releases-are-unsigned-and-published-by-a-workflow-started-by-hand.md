# Releases are unsigned and published by a workflow started by hand

ivin has no Apple Developer ID, so its app cannot be signed or notarised. A workflow the user starts by hand (`.github/workflows/release.yml`, `workflow_dispatch` on `main`) publishes each release: release-it bumps the monorepo's one version from the conventional commits since the last tag (`feat` → minor, `fix` → patch), writes `CHANGELOG.md`, commits it and tags `vX.Y.Z`; the workflow builds the macOS arm64 app, zips it with `ditto`, and publishes a GitHub Release with the zip, a `manifest.json` (version, file name, size, SHA-512) and the changelog section as notes. With no `feat` or `fix` since the last tag it stops and says so. Nothing is pushed until the build has succeeded.

The workflow takes a channel. A beta run passes `--preRelease=beta` to release-it: the first beta after `X.Y.Z` is the next minor or patch version with `-beta.0`, each next beta bumps the number after `beta.`, and the release is published as a GitHub pre-release. A stable run counts the commits since the last stable tag, not the last beta, and passes their level to release-it as `--increment`, so betas can become a stable version with no new commit. A stable release's notes are its own `CHANGELOG.md` section followed by those of the betas since the previous stable version. The app gets betas only with `updates.beta` on, which is on by default when the installed version is a beta.

The app does not update itself through `electron-updater`: Squirrel.Mac refuses an update that has no Developer ID signature. An in-app updater reads the manifest and the zip instead.

## Considered options

- **release-it run locally, and a tag that starts the workflow**: rejected because the release would depend on one machine's state and credentials.
- **`electron-updater` and its `latest-mac.yml`**: rejected as above.
- **Writing `updates.beta: true` into `settings.json` when a beta first starts**: rejected because ivin would change the user's file without being asked. The default follows the installed version instead, so a beta install that updates to a stable version goes back to stable versions, unless the user turned betas on.
- **A signed and notarised release**: not possible without a Developer ID.

## Consequences

- A user opens the app past Gatekeeper's warning, and the zip must be made with `ditto` to keep the symlinks and permissions Electron's frameworks need.
- A failure after the push (creating the release) leaves a tag with no release; the next dispatch then finds nothing to release, so the release is created by hand from the tag.
- Reopened when ivin gets an Apple Developer ID: signing, notarising and `electron-updater` become possible.
