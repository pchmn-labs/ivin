import { useAtom, useAtomValue } from "@effect/atom-react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { newSessionModelAtom, newSessionModelsAtom } from "../atoms/new-session-model.ts"
import { useStartSession } from "../hooks/use-start-session.ts"
import { NewSessionButton } from "./new-session-button.tsx"

export function NewSessionControls({ projectPath }: { projectPath: string }) {
  const [model, setModel] = useAtom(newSessionModelAtom)
  const models = useAtomValue(newSessionModelsAtom)
  const startSession = useStartSession()

  return (
    <>
      <NewSessionButton projectPath={projectPath} icon="new-session" size="md" />
      <Menu
        align="end"
        trigger={<IconButton icon="chevron-down" label="Model for the next session" size="sm" />}
        items={models.map((name) => ({
          label: name,
          ...(name === model && { icon: "check" as const }),
          onSelect: () => {
            setModel(name)
            void startSession(projectPath, name)
          },
        }))}
      />
    </>
  )
}
