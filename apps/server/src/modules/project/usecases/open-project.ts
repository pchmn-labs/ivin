import { ProjectNotTrusted, WorkspaceUnreadable } from "@ivin/contracts/project"
import { DateTime, Effect } from "effect"
import { projectName } from "../rules/project-name.ts"
import { isWorkspaceFile, workspaceName } from "../rules/workspace-file.ts"
import { ProjectTrust } from "./project-trust.ts"
import { ProjectStore } from "./project-store.ts"

export const openProject = (path: string, trustGiven = false) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const trust = yield* ProjectTrust
    const workspace = isWorkspaceFile(path)
    const folders = yield* store.folders(path)
    if (folders === null || folders.length === 0) return yield* new WorkspaceUnreadable({ path })
    const untrusted: string[] = []
    for (const folder of folders) if (!(yield* trust.isTrusted(folder))) untrusted.push(folder)
    if (untrusted.length > 0) {
      if (!trustGiven) {
        return yield* new ProjectNotTrusted(workspace ? { path, folders: untrusted } : { path })
      }
      for (const folder of untrusted) yield* trust.trust(folder)
    }
    yield* store.save({
      path,
      name: workspace ? workspaceName(path) : projectName(path),
      lastOpenedAt: yield* DateTime.now,
    })
    yield* store.addOpen(path)
    yield* store.select(path)
    return yield* store.listOpen
  })
