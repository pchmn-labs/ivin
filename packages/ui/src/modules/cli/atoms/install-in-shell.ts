import type { ShellInstall } from "@ivin/contracts/cli"
import { Cause, Effect } from "effect"
import { AsyncResult, Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { installFailureMessage } from "../rules/shell-install-message.ts"
import { shellInstallAtom } from "./get-shell-install.ts"

// Kept alive so an install the command starts before the page shows still reports there.
export const installInShellAtom = serverRuntime
  .fn<void>()(() =>
    Effect.gen(function* () {
      const client = yield* ServerClient
      const install = yield* client["cli.installInShell"]()
      yield* Atom.refresh(shellInstallAtom)
      return install
    }),
  )
  .pipe(Atom.keepAlive)

export interface ShellInstallState {
  readonly checking: boolean
  readonly checkFailed: boolean
  readonly install: ShellInstall | null
  readonly installing: boolean
  readonly failure: string | null
}

export const shellInstallStateAtom = Atom.readable((get): ShellInstallState => {
  const status = get(shellInstallAtom)
  const action = get(installInShellAtom)
  const installed = AsyncResult.isSuccess(action) ? action.value : null
  return {
    checking: AsyncResult.isInitial(status),
    checkFailed: AsyncResult.isFailure(status),
    // While the status reloads after an install, the install's answer stands in for it.
    install: !AsyncResult.isSuccess(status)
      ? installed
      : status.waiting
        ? (installed ?? status.value)
        : status.value,
    installing: action.waiting,
    failure: AsyncResult.isFailure(action)
      ? installFailureMessage(Cause.squash(action.cause))
      : null,
  }
})
