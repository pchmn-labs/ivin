import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Button } from "../../../core/components/button/button.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { openProjectsAtom } from "../atoms/list-projects.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"
import "./no-project.css"

export function NoProject() {
  const status = useAtomValue(openProjectsAtom.status)
  const { openFolder } = useOpenFolder()
  const message = AsyncResult.isInitial(status)
    ? "Loading the projects…"
    : AsyncResult.isFailure(status)
      ? "Could not load the projects"
      : "No project open"
  return (
    <Stack align="center" justify="center" gap={4} grow>
      <Text tone="muted">{message}</Text>
      {AsyncResult.isSuccess(status) && (
        <Button variant="primary" icon="folder-open" onClick={openFolder}>
          Open folder…
        </Button>
      )}
    </Stack>
  )
}

export function OpenFolderError() {
  const { opened } = useOpenFolder()
  if (!AsyncResult.isFailure(opened)) return null
  return (
    <div className="iv-open-folder-error">
      <Text role="alert" tone="danger">
        Could not open the folder
      </Text>
    </div>
  )
}
