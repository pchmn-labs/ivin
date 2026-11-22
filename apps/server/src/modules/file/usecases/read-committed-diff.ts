import { PathOutsideWorkingFolder } from "@ivin/contracts/file"
import { Effect } from "effect"
import { relativeNames } from "../rules/folder-path.ts"
import { committedChangesOf } from "./list-committed-changes.ts"
import { diffAmong } from "./read-diff.ts"

export const readCommittedDiff = (sessionId: string, path: string) =>
  Effect.gen(function* () {
    if (relativeNames(path) === null)
      return yield* new PathOutsideWorkingFolder({ sessionId, path })
    const listing = yield* committedChangesOf(sessionId)
    if (listing.kind !== "listed") return listing
    return yield* diffAmong(sessionId, path, listing)
  })
