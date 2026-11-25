import { Suspense, useState, type ReactNode } from "react"
import { Icon } from "../icon/icon.tsx"
import "./lazy-on-open.css"

// Mounts `children` (which lazy-loads its code) the first time `open` is true, and keeps it mounted so it can close with its exit motion.
export function LazyOnOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(open)
  if (open && !seen) setSeen(true)
  if (!seen) return null
  return (
    <Suspense
      fallback={
        open ? (
          <div className="iv-lazy-on-open" role="status" aria-label="Loading">
            <Icon name="loader" size={20} />
          </div>
        ) : null
      }
    >
      {children}
    </Suspense>
  )
}
