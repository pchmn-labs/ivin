import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

// One atom per folder, so listing several folders at once gives each its own result.
export const listFolderOf = Atom.family((_folder: string) =>
  serverRuntime.fn<{ readonly sessionId: string; readonly path: string }>()(
    Effect.fnUntraced(function* ({ sessionId, path }) {
      const client = yield* ServerClient
      return yield* client["file.listFolder"]({ sessionId, path })
    }),
  ),
)

export const folderKey = (sessionId: string, path: string) => `${sessionId}\n${path}`
