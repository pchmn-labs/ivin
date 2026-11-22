import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ReactNode } from "react"
import type { Project } from "@ivin/contracts/project"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { projectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-rail.css"

function ProjectButton({ project, selected }: { project: Project; selected: boolean }) {
  const selectProject = useAtomSet(selectProjectAtom)
  const list = sessionsOf(project.path)
  useAtomMount(list.ids)
  const waiting = useAtomValue(list.items).filter((s) => s.status === "waiting").length
  const label = waiting === 0 ? project.name : `${project.name} · ${waiting} waiting for you`

  return (
    <div className="iv-project-rail__item">
      <Tooltip side="right" content={label}>
        <button
          type="button"
          className="iv-project-rail__project"
          aria-label={label}
          aria-current={selected}
          onClick={() => selectProject(project.path)}
        >
          <ProjectCreature name={project.name} size={20} />
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

export function ProjectRail({ actions, children }: { actions?: ReactNode; children?: ReactNode }) {
  const { projects, selectedPath } = useAtomValue(projectsAtom.value)
  const { openFolder } = useOpenFolder()

  return (
    <nav className="iv-project-rail" aria-label="Projects">
      {projects.map((project) => (
        <ProjectButton
          key={project.path}
          project={project}
          selected={project.path === selectedPath}
        />
      ))}
      <IconButton icon="plus" label="Open folder…" size="sm" onClick={openFolder} />
      <span className="iv-project-rail__spacer" />
      {actions}
      {children}
    </nav>
  )
}
