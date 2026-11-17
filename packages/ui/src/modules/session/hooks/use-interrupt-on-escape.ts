import { useAtomSet } from "@effect/atom-react"
import { useEffect } from "react"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"

export function useInterruptOnEscape(target: {
  readonly projectPath: string
  readonly sessionId: string
  readonly running: boolean
}) {
  const interrupt = useAtomSet(interruptSessionAtom)
  const { projectPath, sessionId, running } = target

  useEffect(() => {
    if (!running) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Something closer to the focus, such as the rename input, already used the key.
      if (event.key !== "Escape" || event.defaultPrevented) return
      interrupt({ projectPath, sessionId })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [interrupt, projectPath, sessionId, running])
}
