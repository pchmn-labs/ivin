import { Cause, Effect, Exit } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { errorTag } from "../../../shared/rules/error-tag.ts"
import { withChangedOnDisk, withSaveFailed, withSaved, withSaving } from "../rules/file-edit.ts"
import { saveFailure } from "../rules/file-writing.ts"
import { fileEditOf } from "./file-edit.ts"
import { fileContentOf } from "./read-file.ts"

// True once the draft is on disk. `force` writes over a file that changed on disk.
export const writeFileAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly workingFolder: string
  readonly path: string
  readonly force?: boolean
}>()(
  Effect.fnUntraced(function* ({ sessionId, workingFolder, path, force = false }, get) {
    const atom = fileEditOf(sessionId, workingFolder, path)
    const before = get(atom)
    if (before.draft === null) return true
    if (before.saving || (before.changedOnDisk && !force)) return false
    const text = before.draft
    get.set(atom, withSaving(before))
    const client = yield* ServerClient
    const exit = yield* Effect.exit(
      client["file.writeFile"]({
        sessionId,
        path,
        text,
        expectedVersion: force ? null : (before.base?.version ?? null),
      }),
    )
    if (Exit.isSuccess(exit)) {
      get.set(atom, withSaved(get(atom), text, exit.value.version))
      get.refresh(fileContentOf(sessionId, workingFolder, path))
      return true
    }
    const error = Cause.squash(exit.cause)
    get.set(
      atom,
      errorTag(error) === "FileChangedOnDisk"
        ? withChangedOnDisk(get(atom))
        : withSaveFailed(get(atom), saveFailure(error, path)),
    )
    return false
  }),
)
