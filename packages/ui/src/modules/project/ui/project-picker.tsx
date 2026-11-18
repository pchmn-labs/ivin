import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { getCurrentProjectAtom } from "../atoms/get-current-project.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { groupSessions } from "../../session/rules/group-sessions.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-picker.css"

export function ProjectRail({ footer }: { footer: React.ReactNode }) {
  const current = useAtomValue(getCurrentProjectAtom)
  const { openFolder } = useOpenFolder()
  const project = AsyncResult.isSuccess(current) ? current.value : null

  return (
    <nav className="iv-project-rail" aria-label="Projects">
      {project && <ProjectButton name={project.name} path={project.path} />}
      <div className="iv-project-rail__footer">
        <IconButton icon="plus" label="Open folder…" size="sm" onClick={openFolder} />
        {footer}
      </div>
    </nav>
  )
}

function ProjectButton({ name, path }: { name: string; path: string }) {
  const sessions = useAtomValue(sessionsOf(path).items)
  const waiting = groupSessions(sessions).needsYou.length
  const label = waiting === 0 ? name : `${name} · ${waiting} waiting for you`
  return (
    <div className="iv-project-rail__item">
      <Tooltip side="right" content={`${label} · ${path}`}>
        <button
          type="button"
          className="iv-project-rail__project"
          aria-label={label}
          aria-current="true"
        >
          <ProjectCreature name={name} />
        </button>
      </Tooltip>
      {waiting > 0 && (
        <span className="iv-project-rail__badge" aria-hidden="true" data-testid="project-waiting">
          {waiting}
        </span>
      )}
    </div>
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
