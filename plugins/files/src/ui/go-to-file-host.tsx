import { Suspense, lazy, useEffect, useState } from "react"
import { QuickPick } from "@ivin/plugin-api/ui"
import type { PluginState } from "../rules/plugin-state.ts"

const GoToFile = lazy(() => import("./go-to-file.tsx").then((m) => ({ default: m.GoToFile })))

export function GoToFileHost({ state }: { state: PluginState }) {
  const [shown, setShown] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => {
      setShown(true)
      setOpen(true)
    }
    state.openGoToFile.add(show)
    return () => void state.openGoToFile.delete(show)
  }, [state])
  if (!shown) return null
  return (
    <Suspense
      fallback={
        <QuickPick
          open={open}
          onOpenChange={setOpen}
          label="Go to file"
          query=""
          onQueryChange={() => undefined}
          placeholder="Go to a file"
          items={[]}
          onPick={() => undefined}
          message="Loading…"
        />
      }
    >
      <GoToFile open={open} onOpenChange={setOpen} />
    </Suspense>
  )
}
