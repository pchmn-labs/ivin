const DAY = 86_400_000

export interface StoredImage {
  readonly id: string
  readonly sessionId: string
  readonly sentAt: number
  readonly bytes: number
}

// Deterministic, so a reload shows the same numbers.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

export function makeImages(): StoredImage[] {
  const random = seeded(42)
  const now = Date.now()
  return Array.from({ length: 312 }, (_, i) => {
    const age = Math.floor(random() ** 1.6 * 140)
    return {
      id: `img-${i}`,
      sessionId: `s-${Math.floor(random() * 48)}`,
      sentAt: now - age * DAY - Math.floor(random() * DAY),
      bytes: Math.floor(180_000 + random() ** 2.2 * 8_800_000),
    }
  })
}

export const olderThan = (images: ReadonlyArray<StoredImage>, days: number | null) =>
  days === null ? images : images.filter((image) => image.sentAt < Date.now() - days * DAY)

export const spaceOf = (images: ReadonlyArray<StoredImage>) => ({
  images: images.length,
  bytes: images.reduce((sum, image) => sum + image.bytes, 0),
})

export function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`

export function daysOf(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return n >= 1 ? n : null
}

// A screenshot-shaped picture: a window with a sidebar, a title bar and lines of text.
export function screenshot(hue: number, variant = 0) {
  const lines = Array.from({ length: 7 }, (_, i) => {
    const width = 140 + ((i * 53 + variant * 31) % 150)
    return `<rect x="104" y="${52 + i * 18}" width="${width}" height="7" rx="3" fill="hsl(${hue} 15% 70% / .5)"/>`
  }).join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
    <rect width="400" height="260" fill="hsl(${hue} 20% 14%)"/>
    <rect width="400" height="28" fill="hsl(${hue} 20% 20%)"/>
    <circle cx="14" cy="14" r="4" fill="#ff5f57"/><circle cx="28" cy="14" r="4" fill="#febc2e"/><circle cx="42" cy="14" r="4" fill="#28c840"/>
    <rect y="28" width="84" height="232" fill="hsl(${hue} 20% 18%)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="12" y="${44 + i * 20}" width="${40 + ((i * 17) % 24)}" height="7" rx="3" fill="hsl(${hue} 30% 60% / .45)"/>`).join("")}
    ${lines}
    <rect x="104" y="196" width="220" height="40" rx="6" fill="hsl(${hue} 60% 55% / .35)"/>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
