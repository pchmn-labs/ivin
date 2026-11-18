import { useAtomValue } from "@effect/atom-react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { startSessionFailureAtom } from "../atoms/start-session-failure.ts"
import { useStartSession } from "../hooks/use-start-session.ts"
import "./start-session-error.css"

export function StartSessionError({ projectPath }: { projectPath: string }) {
  const failed = useAtomValue(startSessionFailureAtom)
  const startSession = useStartSession()
  if (failed === null || failed.projectPath !== projectPath) return null
  const { model, failure } = failed
  return (
    <div className="iv-start-session-error">
      <ErrorMessage
        message={failure.text}
        {...(failure.retryable && { onRetry: () => void startSession(projectPath, model) })}
      />
    </div>
  )
}
