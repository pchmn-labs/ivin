import { Atom } from "effect/reactivity"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { sessionsOf } from "./list-sessions.ts"

export const openSessionsAtom = Atom.readable((get) =>
  get(projectsAtom.value).projects.flatMap((project) => get(sessionsOf(project.path).items)),
)
