import { Atom } from "effect/reactivity"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { transcriptOf } from "./get-items.ts"

// Keeps fed the transcript of every session with a tab, in every open project, so switching tabs needs no reload.
export const tabTranscriptsAtom = Atom.readable((get) => {
  for (const project of get(projectsAtom.value).projects)
    for (const tab of get(tabsOf(project.path).value).tabs)
      get(transcriptOf(tab.sessionId).list.ids)
})
