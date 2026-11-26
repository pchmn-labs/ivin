import * as Schema from "effect/Schema"
import { expect, test } from "vitest"
import { apiValues } from "./api-values.ts"

test("dates become epochMilliseconds, at any depth", () => {
  const at = Schema.decodeSync(Schema.DateTimeUtcFromMillis)(1_700_000_000_000)
  expect(apiValues({ id: "a", list: [{ at }], archivedAt: null })).toEqual({
    id: "a",
    list: [{ at: { epochMilliseconds: 1_700_000_000_000 } }],
    archivedAt: null,
  })
})
