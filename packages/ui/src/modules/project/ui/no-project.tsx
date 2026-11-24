import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Button } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { projectsAtom } from "../atoms/list-projects.ts"
import { openFolderFailureAtom } from "../atoms/open-folder-failure.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import "./no-project.css"

export function NoProject() {
  const status = useAtomValue(projectsAtom.status)
  const { openFolder } = useOpenFolder()
  const retry = useAtomRefresh(projectsAtom.status)
  return (
    <Stack align="center" justify="center" gap={4} grow>
      {AsyncResult.isFailure(status) ? (
        <ErrorMessage message="The projects could not be loaded." onRetry={retry} />
      ) : (
        <Text tone="muted">
          {AsyncResult.isInitial(status) ? "Loading the projects…" : "No project open"}
        </Text>
      )}
      {AsyncResult.isSuccess(status) && (
        <Button variant="primary" icon="folder-open" onClick={openFolder}>
          Open folder…
        </Button>
      )}
    </Stack>
  )
}

export function OpenFolderError() {
  const failed = useAtomValue(openFolderFailureAtom)
  const { retry } = useOpenFolder()
  if (failed === null) return null
  const { path, failure } = failed
  return (
    <div className="iv-open-folder-error">
      <ErrorMessage
        message={failure.text}
        {...(failure.retryable && { onRetry: () => retry(path) })}
      />
    </div>
  )
}
