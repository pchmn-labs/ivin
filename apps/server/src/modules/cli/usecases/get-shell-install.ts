import type { ShellInstall } from "@ivin/contracts/cli"
import { Effect } from "effect"
import { commandPathIn, installedLink, isFolderOnPath } from "../rules/shell-install-plan.ts"
import { requireShellCommand, type ShellCommandService } from "./shell-command.ts"

export const shellInstallIn = (shell: ShellCommandService, folder: string) =>
  Effect.map(shell.shellPath, (entries): ShellInstall => ({
    folder,
    path: commandPathIn(folder),
    onPath: entries === null ? null : isFolderOnPath(folder, entries, shell.home),
  }))

export const inspectShellFolders = (shell: ShellCommandService) =>
  Effect.forEach(shell.folders, shell.inspect, { concurrency: "unbounded" })

export const getShellInstall = Effect.gen(function* () {
  const shell = yield* requireShellCommand
  const folder = installedLink(yield* inspectShellFolders(shell), shell.command)
  return folder === null ? null : yield* shellInstallIn(shell, folder)
})
