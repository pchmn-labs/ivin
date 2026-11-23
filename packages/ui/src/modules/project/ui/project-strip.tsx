import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { useLayoutEffect, useRef } from "react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Tooltip } from "../../../core/components/tooltip/tooltip.tsx"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { projectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { waitingCountsAtom } from "../atoms/waiting-counts.ts"
import { useStepProject } from "../hooks/use-step-project.ts"
import { projectLabel } from "../rules/project-label.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-strip.css"

function StripButton({ project, selected }: { project: Project; selected: boolean }) {
  const selectProject = useAtomSet(selectProjectAtom)
  const waiting = useAtomValue(waitingCountsAtom)[project.path] ?? 0
  const label = projectLabel(project.name, waiting)
  return (
    <div className="iv-project-strip__item">
      <Tooltip side="top" content={label}>
        <button
          type="button"
          className="iv-project-strip__project"
          aria-label={label}
          aria-current={selected}
          onClick={() => selectProject(project.path)}
        >
          <ProjectCreature name={project.name} size={12} />
        </button>
      </Tooltip>
      {waiting > 0 && <span className="iv-project-strip__waiting" aria-hidden="true" />}
    </div>
  )
}

export function ProjectStrip() {
  const { projects, selectedPath } = useAtomValue(projectsAtom.value)
  const { canStep, step } = useStepProject()
  const previousHint = useKeyHint("Previous project", "project.previous")
  const nextHint = useKeyHint("Next project", "project.next")
  const row = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    row.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [selectedPath])

  return (
    <div className="iv-project-strip">
      <IconButton
        icon="arrow-left"
        label="Previous project"
        tooltip={previousHint}
        size="sm"
        disabled={!canStep(-1)}
        onClick={() => step(-1)}
      />
      <div ref={row} className="iv-project-strip__row" role="group" aria-label="Projects">
        {projects.map((project) => (
          <StripButton
            key={project.path}
            project={project}
            selected={project.path === selectedPath}
          />
        ))}
      </div>
      <IconButton
        icon="arrow-right"
        label="Next project"
        tooltip={nextHint}
        size="sm"
        disabled={!canStep(1)}
        onClick={() => step(1)}
      />
    </div>
  )
}
