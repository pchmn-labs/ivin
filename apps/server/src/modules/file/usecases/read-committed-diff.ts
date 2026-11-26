import { PathOutsideWorkingFolder, type FileDiff } from "@ivin/contracts/file"
import { Effect } from "effect"
import { relativeNames } from "../rules/folder-path.ts"
import { committedChangesIn } from "./list-committed-changes.ts"
import { diffAmong } from "./read-diff.ts"
import { repositoryOfPath, sessionRoot } from "./repositories.ts"

export const readCommittedDiff = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    const names = relativeNames(path)
    if (names === null) return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const { root, repositories } = yield* sessionRoot(sessionId)
    const inside = repositories === null ? null : repositoryOfPath(repositories, names.join("/"))
    if (repositories !== null && inside === null) return { kind: "unchanged" } satisfies FileDiff
    const listing = yield* committedChangesIn(sessionId, inside?.repository.folder ?? root)
    if (listing.kind !== "listed") return listing
    return yield* diffAmong(sessionId, inside?.path ?? path, listing)
  })
