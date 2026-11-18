import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { getCurrentProjectAtom } from "../atoms/get-current-project.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { initials } from "../rules/initials.ts"
import "./project-picker.css"

export function ProjectRail({ footer }: { footer: React.ReactNode }) {
  const current = useAtomValue(getCurrentProjectAtom)
  const { openFolder } = useOpenFolder()
  const project = AsyncResult.isSuccess(current) ? current.value : null

  return (
    <nav className="iv-project-rail" aria-label="Projects">
      {project && (
        <>
          <Tooltip side="right" content={`${project.name} · ${project.path}`}>
            <button
              type="button"
              className="iv-project-rail__project"
              aria-label={project.name}
              aria-current="true"
            >
              {initials(project.name)}
            </button>
          </Tooltip>
          <IconButton icon="folder-open" label="Open folder…" onClick={openFolder} />
        </>
      )}
      <div className="iv-project-rail__footer">{footer}</div>
    </nav>
  )
}

export function ProjectTitle() {
  const current = useAtomValue(getCurrentProjectAtom)
  const project = AsyncResult.isSuccess(current) ? current.value : null
  if (!project) return null
  return (
    <h1 className="iv-project-title" data-testid="project-name" title={project.path}>
      {project.name}
    </h1>
  )
}

export function NoProject() {
  const current = useAtomValue(getCurrentProjectAtom)
  const { openFolder } = useOpenFolder()
  const message = AsyncResult.isInitial(current)
    ? "Loading the project…"
    : AsyncResult.isFailure(current)
      ? "Could not load the project"
      : "No project open"
  return (
    <Stack align="center" justify="center" gap={4} grow>
      <Text tone="muted">{message}</Text>
      {AsyncResult.isSuccess(current) && (
        <Button variant="primary" icon="folder-open" onClick={openFolder}>
          Open folder…
        </Button>
      )}
    </Stack>
  )
}

export function OpenFolderError() {
  const { opened } = useOpenFolder()
  if (!AsyncResult.isFailure(opened)) return null
  return (
    <div className="iv-open-folder-error">
      <Text role="alert" tone="danger">
        Could not open the folder
      </Text>
    </div>
  )
}
