import { useAtom } from "@effect/atom-react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { Menu } from "../../../core/components/menu/menu.tsx"
import { createSessionAtom } from "../atoms/create-session.ts"
import { newSessionModelAtom } from "../atoms/new-session-model.ts"
import { MODELS } from "../rules/models.ts"

export function NewSessionControls({ projectPath }: { projectPath: string }) {
  const [, createSession] = useAtom(createSessionAtom)
  const [model, setModel] = useAtom(newSessionModelAtom)

  return (
    <>
      <IconButton
        icon="new-session"
        label="New session"
        tooltip={`New session · ${model}`}
        onClick={() => createSession({ projectPath, model })}
      />
      <Menu
        align="end"
        trigger={<IconButton icon="chevron-down" label="Model for the next session" size="sm" />}
        items={MODELS.map((name) => ({
          label: name,
          ...(name === model && { icon: "check" as const }),
          onSelect: () => {
            setModel(name)
            createSession({ projectPath, model: name })
          },
        }))}
      />
    </>
  )
}
