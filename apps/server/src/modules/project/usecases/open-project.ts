import { ProjectNotTrusted } from "@ivin/contracts/project"
import { DateTime, Effect } from "effect"
import { projectName } from "../rules/project-name.ts"
import { FolderTrust } from "./folder-trust.ts"
import { ProjectStore } from "./project-store.ts"

export const openProject = (path: string, trusted = false) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const trust = yield* FolderTrust
    if (!(yield* trust.isTrusted(path))) {
      if (!trusted) return yield* new ProjectNotTrusted({ path })
      yield* trust.trust(path)
    }
    yield* store.save({ path, name: projectName(path), lastOpenedAt: yield* DateTime.now })
    yield* store.addOpen(path)
    yield* store.select(path)
    return yield* store.listOpen
  })
