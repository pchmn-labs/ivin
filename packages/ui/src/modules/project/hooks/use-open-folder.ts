import { useAtom } from "@effect/atom-react"
import { pickFolder } from "../adapters/pick-folder.ts"
import { openProjectAtom } from "../atoms/open-project.ts"

export function useOpenFolder() {
  const [opened, openProject] = useAtom(openProjectAtom)
  const openFolder = async () => {
    const path = await pickFolder()
    if (path !== null) openProject(path)
  }
  return { opened, openFolder: () => void openFolder() }
}
