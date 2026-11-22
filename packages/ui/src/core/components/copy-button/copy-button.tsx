import { useEffect, useState } from "react"
import { copyText } from "../../../shared/adapters/clipboard.ts"
import { IconButton } from "../button/button.tsx"
import "./copy-button.css"

const copiedFor = 1500

// Reads the text on click, so a block still streaming copies what it shows then.
export function CopyButton({ text }: { text: () => string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), copiedFor)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <div className="iv-copy-button" data-copied={copied || undefined}>
      <IconButton
        icon={copied ? "check" : "copy"}
        label={copied ? "Copied" : "Copy"}
        size="sm"
        onClick={() => void copyText(text()).then(() => setCopied(true))}
      />
    </div>
  )
}
