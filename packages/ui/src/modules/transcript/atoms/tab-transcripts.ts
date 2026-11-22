import { Atom } from "effect/reactivity"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { transcriptOf } from "./get-items.ts"

export const tabTranscriptsAtom = Atom.readable((get) => {
  for (const project of get(projectsAtom.value).projects)
    for (const tab of get(tabsOf(project.path).value).tabs)
      // `ids`, not `status`: reading only the feed would let the list it writes be dropped.
      get(transcriptOf(tab.sessionId).list.ids)
})
