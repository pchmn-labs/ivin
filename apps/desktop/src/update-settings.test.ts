import { expect, test } from "vitest"
import { automaticCheckFrom } from "./update-settings.ts"

test("the check is on unless the file turns it off", () => {
  expect(automaticCheckFrom(null)).toBe(true)
  expect(automaticCheckFrom("{}")).toBe(true)
  expect(automaticCheckFrom('{ "updates": { "automaticCheck": true } }')).toBe(true)
  expect(automaticCheckFrom('{ "updates": { "automaticCheck": false } }')).toBe(false)
})

test("a file with comments and trailing commas is read as the settings page reads it", () => {
  expect(automaticCheckFrom('{\n  // offline\n  "updates": { "automaticCheck": false, },\n}')).toBe(
    false,
  )
})

test("a file that cannot be read keeps the check on", () => {
  expect(automaticCheckFrom("{ nope")).toBe(true)
  expect(automaticCheckFrom('["updates"]')).toBe(true)
  expect(automaticCheckFrom('{ "updates": 3 }')).toBe(true)
})
