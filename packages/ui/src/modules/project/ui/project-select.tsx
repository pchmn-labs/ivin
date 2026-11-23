import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { projectsAtom } from "../atoms/list-projects.ts"
import { selectProjectAtom } from "../atoms/select-project.ts"
import { waitingCountsAtom } from "../atoms/waiting-counts.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import { projectLabel } from "../rules/project-label.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-select.css"

export function ProjectSelect({ project }: { project: Project }) {
  const { projects, selectedPath } = useAtomValue(projectsAtom.value)
  const waiting = useAtomValue(waitingCountsAtom)
  const selectProject = useAtomSet(selectProjectAtom)
  const { openFolder } = useOpenFolder()

  return (
    <Menu
      trigger={
        <button
          type="button"
          className="iv-project-select"
          aria-label={`${project.name}, switch project`}
        >
          <ProjectCreature name={project.name} size={16} />
          <span className="iv-project-select__name" data-testid="project-name" title={project.path}>
            {project.name}
          </span>
          <Icon name="chevron-down" size={14} />
        </button>
      }
      items={[
        ...projects.map((each) => {
          const count = waiting[each.path] ?? 0
          return {
            label: each.name,
            "aria-label": projectLabel(each.name, count),
            leading: <ProjectCreature name={each.name} size={16} />,
            ...(count > 0 && {
              trailing: <span className="iv-project-select__waiting">{count}</span>,
            }),
            checked: each.path === selectedPath,
            onSelect: () => selectProject(each.path),
          }
        }),
        "separator" as const,
        { label: "Open folder…", icon: "plus" as const, onSelect: openFolder },
      ]}
    />
  )
}
