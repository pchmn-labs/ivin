// TypeScript 7 ships no JS compiler API, so the tool reads files through the 5.x alias.
import ts from "typescript-compiler-api"

export type ChangedLines = { added: number[]; removedAfter: number[] }
export type ChangedFile = ChangedLines & { path: string; source: string }
// An empty testNames repeats the whole file.
export type FileTarget = { path: string; testNames: string[] }

type TestRange = { start: number; end: number; name: string | undefined }

export const changedLines = (diff: string): Map<string, ChangedLines> => {
  const files = new Map<string, ChangedLines>()
  let current: ChangedLines | undefined
  let inHeader = false
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      current = undefined
      inHeader = true
      continue
    }
    const target = inHeader ? /^\+\+\+ b\/(.+)$/.exec(line) : null
    if (target?.[1] !== undefined) {
      current = { added: [], removedAfter: [] }
      files.set(target[1], current)
      continue
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (current === undefined || hunk === null) continue
    inHeader = false
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    // A pure removal reports the new-side line it follows as its start.
    if (count === 0) current.removedAfter.push(start)
    for (let i = 0; i < count; i++) current.added.push(start + i)
  }
  return files
}

const calleeName = (node: ts.Expression): string | undefined => {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node))
    return calleeName(node.expression)
  return undefined
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const namePattern = (call: ts.CallExpression) => {
  const arg = call.arguments[0]
  if (arg === undefined || !(ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)))
    return undefined
  const escaped = escapeRegExp(arg.text)
  // A test.each(…)(name) fills %s or $field placeholders with each case's values.
  if (!ts.isCallExpression(call.expression)) return escaped
  return escaped
    .replace(/%%|%[sdifjoc#$]/g, (p) => (p === "%%" ? "%" : ".*"))
    .replace(/\\\$[\w.]+/g, ".*")
}

const testRanges = (path: string, source: string): TestRange[] => {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const lineOf = (pos: number) => file.getLineAndCharacterOfPosition(pos).line + 1
  const ranges: TestRange[] = []
  const visit = (node: ts.Node, parents: (string | undefined)[]) => {
    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      const call = node.expression
      const kind = calleeName(call.expression)
      const name = namePattern(call)
      if (kind === "test" || kind === "it") {
        const names = [...parents, name]
        ranges.push({
          start: lineOf(node.getStart(file)),
          end: lineOf(node.getEnd()),
          name: names.every((n) => n !== undefined) ? names.join(" > ") : undefined,
        })
        return
      }
      if (kind === "describe") {
        call.arguments.forEach((arg) => visit(arg, [...parents, name]))
        return
      }
    }
    ts.forEachChild(node, (child) => visit(child, parents))
  }
  visit(file, [])
  return ranges
}

const fileTarget = ({ path, source, added, removedAfter }: ChangedFile): FileTarget[] => {
  const ranges = testRanges(path, source)
  const enclosing = (line: number) => ranges.find((r) => r.start <= line && line <= r.end)
  const lines = source.split("\n")
  const touched = new Set<TestRange>()
  for (const line of added.filter((n) => lines[n - 1]?.trim() !== "")) {
    const range = enclosing(line)
    if (range === undefined) return [{ path, testNames: [] }]
    touched.add(range)
  }
  for (const line of removedAfter) {
    const range = enclosing(line)
    if (range === undefined || line + 1 > range.end) return [{ path, testNames: [] }]
    touched.add(range)
  }
  if (touched.size === 0) return []
  const names = [...touched].flatMap((range) => (range.name === undefined ? [] : [range.name]))
  return [{ path, testNames: names.length === touched.size ? names : [] }]
}

// Playwright runs the packaged app's tests in their own CI job, not Vitest.
const isPackagedAppTest = (path: string) => path.startsWith("apps/desktop/e2e/")

export const repeatTargets = (files: ChangedFile[]): FileTarget[] =>
  files
    .filter((file) => !/\.perf\.test\.tsx?$/.test(file.path) && !isPackagedAppTest(file.path))
    .flatMap(fileTarget)
