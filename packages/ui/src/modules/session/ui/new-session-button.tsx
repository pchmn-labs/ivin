import { useAtomValue } from "@effect/atom-react"
import { IconButton } from "../../../core/components/button/button.tsx"
import type { IconProps } from "../../../core/components/icon/icon.tsx"
import { newSessionModelAtom } from "../atoms/new-session-model.ts"
import { useStartSession } from "../hooks/use-start-session.ts"

export function NewSessionButton({
  projectPath,
  icon,
  size,
}: {
  projectPath: string
  icon: IconProps["name"]
  size?: "sm" | "md"
}) {
  const model = useAtomValue(newSessionModelAtom)
  const startSession = useStartSession()
  return (
    <IconButton
      icon={icon}
      label="New session"
      tooltip={`New session · ${model}`}
      {...(size && { size })}
      onClick={() => void startSession(projectPath, model)}
    />
  )
}
