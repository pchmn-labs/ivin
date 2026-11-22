import { describe, expect, test } from "vitest"
import { changedLines, repeatTargets } from "./targets.ts"

const source = `import { expect, test } from "vitest"

const helper = () => 1

test("first", () => {
  expect(helper()).toBe(1)
})

describe("group", () => {
  test("nested", () => {
    expect(1).toBe(1)
  })
})

test.each([1, 2])("each %i", (n) => {
  expect(n).toBeGreaterThan(0)
})
`

const targets = (added: number[], removedAfter: number[] = []) =>
  repeatTargets([{ path: "a.test.ts", source, added, removedAfter }])

const tests = (...testNames: string[]) => [{ path: "a.test.ts", testNames }]
const wholeFile = [{ path: "a.test.ts", testNames: [] }]

describe("repeatTargets", () => {
  test("a changed line inside a test targets that test by name", () => {
    expect(targets([6])).toEqual(tests("first"))
  })

  test("a test inside a describe is named after both, as Vitest does", () => {
    expect(targets([11])).toEqual(tests("group > nested"))
  })

  test("a test.each name matches any value in place of its placeholders", () => {
    expect(targets([16])).toEqual(tests("each .*"))
  })

  test("a test name is escaped for the -t regex", () => {
    const special = `test("a (b) $c.d?", () => {})\n`
    expect(
      repeatTargets([{ path: "b.test.ts", source: special, added: [1], removedAfter: [] }]),
    ).toEqual([{ path: "b.test.ts", testNames: ["a \\(b\\) \\$c\\.d\\?"] }])
  })

  test("a test whose name is not a plain string repeats the whole file", () => {
    const dynamic = `const n = "x"\ntest(n, () => {})\n`
    expect(
      repeatTargets([{ path: "b.test.ts", source: dynamic, added: [2], removedAfter: [] }]),
    ).toEqual([{ path: "b.test.ts", testNames: [] }])
  })

  test("two changed lines in one test target it once", () => {
    expect(targets([5, 6, 7])).toEqual(tests("first"))
  })

  test("changed lines in two tests target both", () => {
    expect(targets([6, 11])).toEqual(tests("first", "group > nested"))
  })

  test("a changed line outside any test repeats the whole file", () => {
    expect(targets([3, 6])).toEqual(wholeFile)
  })

  test("an added blank line outside any test is ignored", () => {
    expect(targets([4, 5, 6, 7, 8])).toEqual(tests("first"))
  })

  test("a describe line outside its tests repeats the whole file", () => {
    expect(targets([9])).toEqual(wholeFile)
  })

  test("a frame-rate test file is never targeted", () => {
    expect(
      repeatTargets([{ path: "a.perf.test.tsx", source, added: [6], removedAfter: [] }]),
    ).toEqual([])
  })

  test("a file with no changed line is not targeted", () => {
    expect(targets([])).toEqual([])
  })

  test("lines removed inside a test target that test", () => {
    expect(targets([], [6])).toEqual(tests("first"))
  })

  test("lines removed between two tests target nothing", () => {
    expect(targets([], [7])).toEqual([])
  })
})

describe("changedLines", () => {
  test("reads the new-side lines of added and changed hunks, per file", () => {
    const diff = `diff --git a/a.test.ts b/a.test.ts
--- a/a.test.ts
+++ b/a.test.ts
@@ -5,0 +6,2 @@ test("first", () => {
+  a
+  b
@@ -20 +22 @@
-x
+y
diff --git a/b.test.tsx b/b.test.tsx
new file mode 100644
--- /dev/null
+++ b/b.test.tsx
@@ -0,0 +1,3 @@
+1
+2
+3
`
    expect(changedLines(diff)).toEqual(
      new Map([
        ["a.test.ts", { added: [6, 7, 22], removedAfter: [] }],
        ["b.test.tsx", { added: [1, 2, 3], removedAfter: [] }],
      ]),
    )
  })

  test("a hunk that only removes lines records the line it removed them after", () => {
    const diff = `diff --git a/a.test.ts b/a.test.ts
--- a/a.test.ts
+++ b/a.test.ts
@@ -7,2 +6,0 @@ test("first", () => {
-  a
-  b
`
    expect(changedLines(diff)).toEqual(new Map([["a.test.ts", { added: [], removedAfter: [6] }]]))
  })

  test("a deleted file is left out", () => {
    const diff = `diff --git a/a.test.ts b/a.test.ts
deleted file mode 100644
--- a/a.test.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-1
-2
`
    expect(changedLines(diff)).toEqual(new Map())
  })
})
