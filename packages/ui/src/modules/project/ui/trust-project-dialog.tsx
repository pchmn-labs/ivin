import { useAtom } from "@effect/atom-react"
import { useRef } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { projectToTrustAtom } from "../atoms/project-to-trust.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"

export function TrustProjectDialog() {
  const [project, setProject] = useAtom(projectToTrustAtom)
  const { trust } = useOpenFolder()
  // The dialog keeps its text while it fades out.
  const shown = useRef(project)
  if (project !== null) shown.current = project
  const path = shown.current?.path ?? ""
  const folders = shown.current?.folders ?? []
  const workspace = folders.length > 0
  const name = path.split("/").findLast((part) => part !== "") ?? path
  const close = () => setProject(null)
  return (
    <Dialog
      open={project !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={workspace ? `Trust ${folders.length} folders of “${name}”?` : `Trust “${name}”?`}
      description={`ivin runs git and the agent in ${workspace ? "these folders" : "this folder"}, and both run commands its own files can set up, such as git hooks and the agent's project settings. Trust ${workspace ? "them" : "it"} only if you know where ${workspace ? "they come" : "it comes"} from.`}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (project === null) return
              close()
              trust(project.path)
            }}
          >
            {workspace ? "Trust" : "Trust and open"}
          </Button>
        </>
      }
    >
      <Text size="xs" tone="faint" mono preWrap>
        {workspace ? folders.join("\n") : path}
      </Text>
    </Dialog>
  )
}
