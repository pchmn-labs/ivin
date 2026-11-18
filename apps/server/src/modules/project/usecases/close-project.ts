import { ProjectNotOpen } from "@ivin/contracts/project"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/neighbour.ts"
import { TabStore } from "../../tab/usecases/tab-store.ts"
import { ProjectStore } from "./project-store.ts"

export const closeProject = (path: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const tabs = yield* TabStore
    const open = yield* store.listOpen
    const order = open.projects.map((project) => project.path)
    if (!order.includes(path)) return yield* new ProjectNotOpen({ path })
    yield* tabs.removeByProject(path)
    yield* store.removeOpen(path)
    if (open.selectedPath === path) yield* store.select(selectionAfterRemoval(order, path))
    return yield* store.listOpen
  })
