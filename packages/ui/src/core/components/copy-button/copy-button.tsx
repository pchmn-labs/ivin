import { useEffect, useState } from "react"
import { copyText } from "../../../shared/adapters/clipboard.ts"
import { IconButton } from "../button/button.tsx"
import "./copy-button.css"

const copiedMs = 1500

export function CopyButton({
  text,
}: {
  // Read on click, so a block still streaming copies what it shows then.
  text: () => string
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), copiedMs)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <div className="iv-copy-button" data-copied={copied || undefined}>
      <IconButton
        icon={copied ? "check" : "copy"}
        label={copied ? "Copied" : "Copy"}
        size="sm"
        onClick={() =>
          void copyText(text()).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      />
    </div>
  )
}
