import type { FolderRefusal } from "@ivin/contracts/cli"
import { Effect, Layer } from "effect"
import { execFile } from "node:child_process"
import {
  accessSync,
  constants,
  lstatSync,
  mkdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs"
import { dirname } from "node:path"
import { logError } from "../../log/usecases/log-error.ts"
import { commandPathIn, type IvinEntry, type ShellFolder } from "../rules/shell-install-plan.ts"
import { ShellCommand } from "../usecases/shell-command.ts"

const refusalOf = (error: unknown): FolderRefusal => {
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code === "EACCES" || code === "EPERM") return "permissionDenied"
  if (code === "EROFS") return "readOnly"
  if (code === "ENOTDIR" || code === "EEXIST") return "notAFolder"
  return "unknown"
}

// A missing folder is writable when the closest folder above it that exists is.
export const folderRefusal = (folder: string): FolderRefusal | null => {
  let path = folder
  try {
    while (true) {
      const stat = statSync(path, { throwIfNoEntry: false })
      if (stat !== undefined) {
        if (!stat.isDirectory()) return "notAFolder"
        accessSync(path, constants.W_OK)
        return null
      }
      if (dirname(path) === path) return "unknown"
      path = dirname(path)
    }
  } catch (error) {
    return refusalOf(error)
  }
}

export const ivinEntry = (folder: string): IvinEntry => {
  const path = commandPathIn(folder)
  try {
    const stat = lstatSync(path, { throwIfNoEntry: false })
    if (stat === undefined) return { kind: "absent" }
    return stat.isSymbolicLink() ? { kind: "link", target: readlinkSync(path) } : { kind: "other" }
  } catch {
    // A folder ivin cannot read is refused anyway; its entry does not count.
    return { kind: "absent" }
  }
}

export const inspectFolder = (folder: string): ShellFolder => ({
  path: folder,
  refusal: folderRefusal(folder),
  entry: ivinEntry(folder),
})

export const linkCommand = (folder: string, command: string) => {
  mkdirSync(folder, { recursive: true })
  const path = commandPathIn(folder)
  const temporary = `${path}.${process.pid}.tmp`
  rmSync(temporary, { force: true })
  symlinkSync(command, temporary)
  try {
    // A rename, so a shell never finds the command missing while it is replaced.
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

const MARK = "__IVIN_PATH__"
export const LOGIN_SHELL_TIMEOUT_MS = 5_000

export const readLoginShellPath = (shell: string, timeoutMs: number) =>
  Effect.callback<ReadonlyArray<string> | null>((resume) => {
    const child = execFile(
      shell,
      ["-ilc", `printf '%s%s%s' ${MARK} "$PATH" ${MARK}`],
      // The app's own PATH would leak into the answer: a login shell adds to the PATH it starts with.
      { timeout: timeoutMs, env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin" } },
      (error, stdout) => {
        const found = stdout.split(MARK)
        resume(Effect.succeed(error === null && found.length >= 3 ? found[1]!.split(":") : null))
      },
    )
    child.stdin?.end()
    return Effect.sync(() => child.kill())
  })

export const layerFsShellCommand = (options: {
  readonly command: string
  readonly home: string
  readonly folders: ReadonlyArray<string>
  readonly shellPath: Effect.Effect<ReadonlyArray<string> | null>
}) =>
  Layer.succeed(ShellCommand)({
    command: options.command,
    home: options.home,
    folders: options.folders,
    inspect: (folder) => Effect.sync(() => inspectFolder(folder)),
    link: (folder) =>
      Effect.try({
        try: () => linkCommand(folder, options.command),
        catch: (error) => error,
      }).pipe(
        Effect.tapError((error) => logError("cli.installInShell", error)),
        Effect.mapError(refusalOf),
      ),
    shellPath: options.shellPath,
  })
