import beside from "@phosphor-icons/core/assets/regular/square-split-horizontal.svg?raw"
import sheet from "@phosphor-icons/core/assets/regular/square-half-bottom.svg?raw"
import dialog from "@phosphor-icons/core/assets/regular/app-window.svg?raw"
import move from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw"
import type { Placement } from "./scene.tsx"

const SVG = { subView: beside, sheet, dialog, move } as const

export function PlacementIcon({ name, size = 14 }: { name: Placement | "move"; size?: number }) {
  const raw = SVG[name]
  return (
    <svg
      className="iv-icon"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: raw.slice(raw.indexOf(">") + 1, raw.lastIndexOf("</svg>")) }}
    />
  )
}
