import { Effect } from "effect"
import { installedLink } from "../rules/shell-install-plan.ts"
import { inspectShellFolders, requireShellCommand, shellInstallIn } from "./shell-command.ts"

export const getShellInstall = Effect.gen(function* () {
  const shell = yield* requireShellCommand
  const folder = installedLink(yield* inspectShellFolders(shell), shell.command)
  return folder === null ? null : yield* shellInstallIn(shell, folder)
})
