import type { ImageData } from "@ivin/contracts/transcript"
import {
  SessionNotFound,
  type WorkingFolderChoice,
  WorkingFolderDeleted,
} from "@ivin/contracts/session"
import { Effect } from "effect"
import { ImageStore } from "../../transcript/usecases/image-store.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { titleFromMessage } from "../rules/session-title.ts"
import { checkWorkingFolder } from "./check-working-folder.ts"
import { moveToExistingWorktree, moveToNewWorktree } from "./move-working-folder.ts"
import { SessionRuns } from "./session-runs.ts"
import { SessionStore } from "./session-store.ts"

export const sendMessage = (
  sessionId: string,
  messageId: string,
  text: string,
  images: readonly ImageData[],
  workingFolder?: WorkingFolderChoice,
) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const runs = yield* SessionRuns
    const git = yield* Git
    const found = yield* store.findById(sessionId)
    if (!found) return yield* new SessionNotFound({ sessionId })
    if ((yield* checkWorkingFolder(found)).workingFolderDeleted) {
      return yield* new WorkingFolderDeleted({ sessionId })
    }
    if (!found.started) {
      if (workingFolder?.kind === "new_worktree") {
        yield* moveToNewWorktree(found, "creation")
      } else if (workingFolder?.kind === "existing_worktree") {
        yield* moveToExistingWorktree(found, workingFolder.path, "choice")
      } else {
        // The user may have switched branches in the checkout since the session was created.
        yield* store.setWorkingFolder(
          sessionId,
          found.workingFolder,
          yield* git.currentBranch(found.workingFolder),
        )
      }
    }
    const title = titleFromMessage(text)
    if (title !== "") yield* store.setTitleIfUnset(sessionId, title)
    const session = (yield* store.findById(sessionId)) ?? found
    yield* (yield* ImageStore).save(sessionId, images)
    yield* runs.send(session, { id: messageId, text, images })
    return (yield* store.findById(sessionId)) ?? session
  })
