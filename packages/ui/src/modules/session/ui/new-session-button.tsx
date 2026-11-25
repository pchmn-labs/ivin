import { IconButton } from "../../../core/components/button/button.tsx"
import type { IconProps } from "../../../core/components/icon/icon.tsx"
import { useStartSession } from "../hooks/use-start-session.ts"

export function NewSessionButton({
  projectPath,
  icon,
  size,
  after,
}: {
  projectPath: string
  icon: IconProps["name"]
  size?: "sm" | "md"
  after?: string | undefined
}) {
  const startSession = useStartSession()
  return (
    <IconButton
      icon={icon}
      label="New session"
      tooltip="New session"
      {...(size && { size })}
      onClick={() => void startSession(projectPath, after)}
    />
  )
}
