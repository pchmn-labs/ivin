export const HUE_COUNT = 6

export interface Creature {
  readonly hue: number
  readonly cells: ReadonlyArray<{ readonly x: number; readonly y: number }>
}

const hashName = (name: string) => {
  let h = 2166136261
  for (const char of name) {
    h ^= char.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return h
}

// An 8x8 sprite mirrored left to right, with a fixed body so every name gets a recognisable creature.
export const creature = (name: string): Creature => {
  let h = hashName(name)
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  const hue = Math.floor(random() * HUE_COUNT)
  const half = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 4 }, () => random() < (y === 0 || y === 7 ? 0.35 : 0.6)),
  )
  for (let y = 2; y < 6; y++) half[y]![3] = true
  half[2]![2] = half[3]![1] = half[4]![1] = half[4]![2] = true
  half[3]![2] = false

  const cells: Array<{ x: number; y: number }> = []
  half.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (filled) cells.push({ x, y }, { x: 7 - x, y })
    }),
  )
  return { hue, cells }
}
