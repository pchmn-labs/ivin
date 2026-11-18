import { useAtomSet } from "@effect/atom-react"
import type { Project } from "@ivin/contracts/project"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { NewSessionControls } from "../../session/ui/new-session-controls.tsx"
import { SessionList } from "../../session/ui/session-list.tsx"
import { closeProjectAtom } from "../atoms/close-project.ts"
import { ProjectCreature } from "./project-creature.tsx"
import "./project-column.css"

export function ProjectColumn({ project }: { project: Project }) {
  const closeProject = useAtomSet(closeProjectAtom)
  return (
    <div className="iv-project-column">
      <div className="iv-project-column__head">
        <ProjectCreature name={project.name} size={16} />
        <h1 className="iv-project-column__name" data-testid="project-name" title={project.path}>
          {project.name}
        </h1>
        <NewSessionControls projectPath={project.path} />
        <Menu
          align="end"
          trigger={<IconButton icon="ellipsis" label="Project actions" size="sm" />}
          items={[
            {
              label: "Close project",
              icon: "x",
              onSelect: () => closeProject(project.path),
            },
          ]}
        />
      </div>
      <SessionList projectPath={project.path} projectName={project.name} />
    </div>
  )
}
