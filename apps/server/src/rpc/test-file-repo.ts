import { Effect } from "effect"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { git } from "./git-fixture.ts"
import { type Client, withServer } from "./test-server.ts"

export const write = (path: string, text = "") => {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text)
}

export const commitAll = (repo: string) => {
  git(repo, "add", "--all")
  git(repo, "commit", "--quiet", "-m", "commit")
}

// Runs `call` in a new session of `projectPath`, and the error's tag when it fails.
export const callIn = <A>(
  projectPath: string,
  call: (client: Client, sessionId: string) => Effect.Effect<A, { readonly _tag: string }>,
) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      return yield* call(client, id).pipe(Effect.catch((error) => Effect.succeed(error._tag)))
    }),
  )

export const changesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listChanges"]({ sessionId }))
