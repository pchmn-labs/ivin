import { Atom } from "effect/reactivity"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { projectsAtom } from "./list-projects.ts"

// By project path: the sessions waiting on the user.
export const waitingCountsAtom = Atom.readable((get) =>
  Object.fromEntries(
    get(projectsAtom.value).projects.map((project) => {
      const waiting = get(sessionsOf(project.path).items).filter(
        (session) => session.status === "waiting",
      ).length
      return [project.path, waiting]
    }),
  ),
)
