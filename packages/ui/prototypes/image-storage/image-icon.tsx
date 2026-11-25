import { ImageBrokenIcon } from "@phosphor-icons/react/dist/csr/ImageBroken"
import { ImageIcon as PhosphorImage } from "@phosphor-icons/react/dist/csr/Image"

export function ImageIcon({ size }: { size: number }) {
  return <PhosphorImage size={size} aria-hidden />
}

export function BrokenImageIcon({ size }: { size: number }) {
  return <ImageBrokenIcon size={size} aria-hidden />
}
