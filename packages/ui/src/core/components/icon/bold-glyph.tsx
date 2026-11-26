import check from "@phosphor-icons/core/assets/bold/check-bold.svg?raw"
import exclamation from "@phosphor-icons/core/assets/bold/exclamation-mark-bold.svg?raw"
import x from "@phosphor-icons/core/assets/bold/x-bold.svg?raw"
import { innerOf } from "./icon.tsx"

const glyphs = { check, x, exclamation }

// The regular weight is too thin to read at 5 to 8 px, so a mark inside a disc uses the bold one.
export function BoldGlyph({ name, size }: { name: keyof typeof glyphs; size: number }) {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: innerOf(glyphs[name]) }}
    />
  )
}
