import { useAtom, useAtomSet } from "@effect/atom-react"
import type { ReactNode } from "react"
import type { Project } from "@ivin/contracts/project"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { useCommandKey } from "../../keybinding/hooks/use-key-hint.ts"
import { archivedViewOpenAtom } from "../../session/atoms/archived-view.ts"
import { ArchivedSessionList } from "../../session/ui/archived-session-list.tsx"
import { NewSessionButton } from "../../session/ui/new-session-button.tsx"
import { closeProjectAtom } from "../atoms/close-project.ts"
import { ProjectCreature } from "./project-creature.tsx"
import { ProjectSelect } from "./project-select.tsx"
import "./project-column.css"

export function ProjectColumn({
  project,
  projectMenu = false,
  children,
}: {
  project: Project
  projectMenu?: boolean
  children: ReactNode
}) {
  const closeProject = useAtomSet(closeProjectAtom)
  const [archivedOpen, setArchivedOpen] = useAtom(archivedViewOpenAtom)
  const archivedKey = useCommandKey("session.showArchived")
  if (archivedOpen) {
    return (
      <div className="iv-project-column">
        <ArchivedSessionList
          projectPath={project.path}
          projectName={project.name}
          onBack={() => setArchivedOpen(false)}
        />
      </div>
    )
  }
  return (
    <div className="iv-project-column">
      <div className="iv-project-column__head" data-project-menu={projectMenu || undefined}>
        {projectMenu ? (
          <ProjectSelect project={project} />
        ) : (
          <>
            <ProjectCreature name={project.name} size={16} />
            <h1 className="iv-project-column__name" data-testid="project-name" title={project.path}>
              {project.name}
            </h1>
          </>
        )}
        <NewSessionButton projectPath={project.path} icon="new-session" size="md" />
        <Menu
          align="end"
          trigger={<IconButton icon="ellipsis" label="Project actions" size="sm" />}
          items={[
            {
              label: "Archived sessions",
              icon: "archive",
              ...(archivedKey !== null && { hint: archivedKey }),
              onSelect: () => setArchivedOpen(true),
            },
            "separator",
            {
              label: "Close project",
              icon: "x",
              onSelect: () => closeProject(project.path),
            },
          ]}
        />
      </div>
      {children}
    </div>
  )
}
