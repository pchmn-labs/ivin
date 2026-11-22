import { ShellCommandNotOurs, ShellFoldersRefused } from "@ivin/contracts/cli"
import { Effect } from "effect"
import { shellInstallPlan } from "../rules/shell-install-plan.ts"
import { inspectShellFolders, requireShellCommand, shellInstallIn } from "./shell-command.ts"

export const installInShell = Effect.gen(function* () {
  const shell = yield* requireShellCommand
  const folders = yield* inspectShellFolders(shell)
  const plan = shellInstallPlan(folders, shell.command)
  if (plan.kind === "notOurs") return yield* new ShellCommandNotOurs({ path: plan.path })
  if (plan.kind === "refused") return yield* new ShellFoldersRefused({ folders: plan.folders })
  yield* shell
    .link(plan.folder)
    .pipe(
      Effect.catch((reason) =>
        Effect.fail(new ShellFoldersRefused({ folders: [{ path: plan.folder, reason }] })),
      ),
    )
  return yield* shellInstallIn(shell, plan.folder)
})
