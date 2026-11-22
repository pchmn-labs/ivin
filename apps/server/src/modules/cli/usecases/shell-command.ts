import type { FolderRefusal, ShellInstall } from "@ivin/contracts/cli"
import { Context, Effect, Layer, Ref } from "effect"
import { commandPathIn, isFolderOnPath, type ShellFolder } from "../rules/shell-install-plan.ts"

export interface ShellCommandService {
  // The `ivin` script the desktop app writes; the link points at it.
  readonly command: string
  readonly home: string
  // In order of preference.
  readonly folders: ReadonlyArray<string>
  readonly inspect: (folder: string) => Effect.Effect<ShellFolder>
  // Creates the folder when missing, then puts the link in place, replacing what is there.
  readonly link: (folder: string) => Effect.Effect<void, FolderRefusal>
  // The PATH of the user's login shell, which an app opened from the Dock does not inherit.
  readonly shellPath: Effect.Effect<ReadonlyArray<string> | null>
}

// Null when the server runs without the desktop app, which writes the command.
export const ShellCommand = Context.Reference<ShellCommandService | null>(
  "ivin/server/ShellCommand",
  { defaultValue: () => null },
)

export const requireShellCommand = Effect.gen(function* () {
  const service = yield* ShellCommand
  return service ?? (yield* Effect.die(new Error("no ivin command to install")))
})

export const inspectShellFolders = (shell: ShellCommandService) =>
  Effect.forEach(shell.folders, shell.inspect, { concurrency: "unbounded" })

export const shellInstallIn = (shell: ShellCommandService, folder: string) =>
  Effect.map(shell.shellPath, (entries): ShellInstall => ({
    folder,
    path: commandPathIn(folder),
    onPath: entries === null ? null : isFolderOnPath(folder, entries, shell.home),
  }))

// Folders held in memory; a link fails with a folder's refusal, else replaces its entry.
export const layerShellCommandOf = (options: {
  readonly command: string
  readonly folders: ReadonlyArray<ShellFolder>
  readonly shellPath: ReadonlyArray<string> | null
  readonly linkRefusal?: FolderRefusal
}) =>
  Layer.effect(ShellCommand)(
    Effect.gen(function* () {
      const folders = yield* Ref.make(options.folders)
      const find = (path: string) =>
        Ref.get(folders).pipe(Effect.map((all) => all.find((folder) => folder.path === path)!))
      return {
        command: options.command,
        home: "/Users/me",
        folders: options.folders.map((folder) => folder.path),
        inspect: find,
        link: (path) =>
          Effect.gen(function* () {
            const folder = yield* find(path)
            const refusal = folder.refusal ?? options.linkRefusal ?? null
            if (refusal !== null) return yield* Effect.fail(refusal)
            yield* Ref.update(folders, (all) =>
              all.map((f) =>
                f.path === path ? { ...f, entry: { kind: "link", target: options.command } } : f,
              ),
            )
          }),
        shellPath: Effect.succeed(options.shellPath),
      } satisfies ShellCommandService
    }),
  )
