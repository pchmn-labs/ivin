import type { ShellInstall } from "@ivin/contracts/cli"
import { Cause, Effect } from "effect"
import { AsyncResult, Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { installFailureMessage } from "../rules/shell-install-message.ts"
import { getShellInstallAtom } from "./get-shell-install.ts"

// Kept alive so an install the command starts before the page shows still reports there.
export const installInShellAtom = serverRuntime
  .fn<void>()(() =>
    Effect.gen(function* () {
      const client = yield* ServerClient
      const install = yield* client["cli.installInShell"]()
      yield* Atom.refresh(getShellInstallAtom)
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

const shownInstall = (
  status: AsyncResult.AsyncResult<ShellInstall | null, unknown>,
  installed: ShellInstall | null,
) => {
  if (!AsyncResult.isSuccess(status)) return installed
  // While the status reloads after an install, the install's answer stands in for it.
  return status.waiting ? (installed ?? status.value) : status.value
}

export const shellInstallStateAtom = Atom.readable((get): ShellInstallState => {
  const status = get(getShellInstallAtom)
  const action = get(installInShellAtom)
  const installed = AsyncResult.isSuccess(action) ? action.value : null
  return {
    checking: AsyncResult.isInitial(status),
    checkFailed: AsyncResult.isFailure(status),
    install: shownInstall(status, installed),
    installing: action.waiting,
    failure: AsyncResult.isFailure(action)
      ? installFailureMessage(Cause.squash(action.cause))
      : null,
  }
})
