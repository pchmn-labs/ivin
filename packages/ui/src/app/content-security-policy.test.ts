import { expect, test } from "vitest"
import { readFileSync } from "node:fs"

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")

const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)![1]!

const directives = new Map(
  policy.split(";").map((part) => {
    const [name = "", ...sources] = part.trim().split(/\s+/)
    return [name, sources] as const
  }),
)

test("the renderer refuses a request to another origin: connect-src falls back to default-src 'self'", () => {
  expect(directives.get("default-src")).toEqual(["'self'"])
  expect(directives.has("connect-src")).toBe(false)
})

test("no directive allows a remote origin or any origin", () => {
  for (const sources of directives.values()) {
    expect(sources.filter((source) => /^(\*|https?:|wss?:)/.test(source))).toEqual([])
  }
})
