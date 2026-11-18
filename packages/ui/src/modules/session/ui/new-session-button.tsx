import { useAtomValue, useAtomSet } from "@effect/atom-react"
import { IconButton } from "../../../core/components/button/button.tsx"
import { createSessionAtom } from "../atoms/create-session.ts"
import { newSessionModelAtom } from "../atoms/new-session-model.ts"

export function NewSessionButton({ projectPath }: { projectPath: string }) {
  const model = useAtomValue(newSessionModelAtom)
  const createSession = useAtomSet(createSessionAtom)
  return (
    <IconButton
      icon="plus"
      label="New session"
      tooltip={`New session · ${model}`}
      size="sm"
      onClick={() => createSession({ projectPath, model })}
    />
  )
}
