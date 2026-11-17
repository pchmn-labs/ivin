import { useAtom, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { pickFolder } from "../adapters/pick-folder.ts"
import { getCurrentProjectAtom } from "../atoms/get-current-project.ts"
import { openProjectAtom } from "../atoms/open-project.ts"

export function ProjectPicker() {
  const current = useAtomValue(getCurrentProjectAtom)
  const [opened, openProject] = useAtom(openProjectAtom)

  const openFolder = async () => {
    const path = await pickFolder()
    if (path !== null) openProject(path)
  }

  const project = AsyncResult.isSuccess(current) ? current.value : null
  return (
    <section>
      {project ? (
        <p data-testid="project-name" title={project.path}>
          {project.name}
        </p>
      ) : (
        <p>
          {AsyncResult.isInitial(current)
            ? "Loading the project…"
            : AsyncResult.isFailure(current)
              ? "Could not load the project"
              : "No project open"}
        </p>
      )}
      <button type="button" onClick={() => void openFolder()}>
        Open folder…
      </button>
      {AsyncResult.isFailure(opened) && <p role="alert">Could not open the folder</p>}
    </section>
  )
}
