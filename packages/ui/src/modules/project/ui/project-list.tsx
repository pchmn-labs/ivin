import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { IconButton } from "../../../core/components/button/button.tsx"
import { ListRow } from "../../../core/components/list-row/list-row.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { SessionList } from "../../session/ui/session-list.tsx"
import { closeProjectAtom } from "../atoms/close-project.ts"
import { openProjectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-list.css"

function ProjectRow({ project, selected }: { project: Project; selected: boolean }) {
  const selectProject = useAtomSet(selectProjectAtom)
  const closeProject = useAtomSet(closeProjectAtom)
  const list = sessionsOf(project.path)
  useAtomMount(list.ids)
  const waiting = useAtomValue(list.items).filter((s) => s.status === "waiting").length

  return (
    <li className="iv-project-list__project">
      <ListRow
        data-testid="project-item"
        selected={selected}
        onSelect={() => selectProject(project.path)}
        leading={<ProjectCreature name={project.name} size={16} />}
        title={
          <span data-testid="project-name" title={project.path}>
            {project.name}
          </span>
        }
        meta={
          waiting > 0 && (
            <span
              className="iv-project-list__badge"
              role="img"
              aria-label={`${waiting} waiting for you`}
              data-testid="project-waiting"
            >
              {waiting}
            </span>
          )
        }
        actions={
          <IconButton
            icon="x"
            label={`Close ${project.name}`}
            size="sm"
            onClick={() => closeProject(project.path)}
          />
        }
      />
      {selected && <SessionList projectPath={project.path} />}
    </li>
  )
}

export function ProjectList() {
  const { projects, selectedPath } = useAtomValue(openProjectsAtom.value)
  const { openFolder } = useOpenFolder()

  return (
    <nav className="iv-project-list" aria-label="Projects">
      <div className="iv-project-list__head">
        <h2 className="iv-project-list__label">Projects</h2>
        <IconButton icon="plus" label="Open folder…" size="sm" onClick={openFolder} />
      </div>
      <ul className="iv-project-list__rows">
        {projects.map((project) => (
          <ProjectRow
            key={project.path}
            project={project}
            selected={project.path === selectedPath}
          />
        ))}
      </ul>
    </nav>
  )
}
