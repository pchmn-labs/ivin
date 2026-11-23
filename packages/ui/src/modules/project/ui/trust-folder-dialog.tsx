import { useAtom } from "@effect/atom-react"
import { useRef } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { folderToTrustAtom } from "../atoms/folder-to-trust.ts"
import { useOpenFolder } from "../hooks/use-open-folder.ts"

export function TrustFolderDialog() {
  const [folder, setFolder] = useAtom(folderToTrustAtom)
  const { trust } = useOpenFolder()
  // The dialog keeps its text while it fades out.
  const shown = useRef(folder)
  if (folder !== null) shown.current = folder
  const path = shown.current ?? ""
  const close = () => setFolder(null)
  return (
    <Dialog
      open={folder !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={`Trust “${path.split("/").findLast((part) => part !== "") ?? path}”?`}
      description="ivin runs git and the agent in this folder, and both run commands its own files can set up, such as git hooks and the agent's project settings. Trust it only if you know where it comes from."
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (folder === null) return
              close()
              trust(folder)
            }}
          >
            Trust and open
          </Button>
        </>
      }
    >
      <Text size="xs" tone="faint" mono preWrap>
        {path}
      </Text>
    </Dialog>
  )
}
