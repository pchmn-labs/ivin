import { expect, test } from "vitest"
import { HUE_COUNT, creature } from "./creature.ts"

test("the same name always gives the same creature", () => {
  expect(creature("ivin")).toEqual(creature("ivin"))
})

test("different names give different creatures", () => {
  const sprites = new Set(
    ["ivin", "silbo", "api", "website", "docs"].map((n) => JSON.stringify(creature(n))),
  )
  expect(sprites.size).toBeGreaterThan(1)
})

test("the sprite is mirrored and stays inside the 8x8 grid", () => {
  const { cells } = creature("silbo")
  const keys = new Set(cells.map(({ x, y }) => `${x},${y}`))
  for (const { x, y } of cells) {
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThan(8)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThan(8)
    expect(keys.has(`${7 - x},${y}`)).toBe(true)
  }
})

test("every sprite has the fixed body in its middle rows", () => {
  const keys = new Set(creature("anything").cells.map(({ x, y }) => `${x},${y}`))
  for (let y = 2; y < 6; y++) {
    expect(keys.has(`3,${y}`)).toBe(true)
    expect(keys.has(`4,${y}`)).toBe(true)
  }
})

test("the hue is one of the project hues", () => {
  for (const name of ["a", "ivin", "silbo", "my-project", "日本語"]) {
    const { hue } = creature(name)
    expect(Number.isInteger(hue)).toBe(true)
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(HUE_COUNT)
  }
})
