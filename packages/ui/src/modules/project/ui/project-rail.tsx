import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { projectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { waitingCountsAtom } from "../atoms/waiting-counts.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { projectLabel } from "../rules/project-label.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-rail.css"

function ProjectButton({ project, selected }: { project: Project; selected: boolean }) {
  const selectProject = useAtomSet(selectProjectAtom)
  const waiting = useAtomValue(waitingCountsAtom)[project.path] ?? 0
  const label = projectLabel(project.name, waiting)

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

export function ProjectRail() {
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
    </nav>
  )
}
