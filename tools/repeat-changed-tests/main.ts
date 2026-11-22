import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { changedLines, repeatTargets, type FileTarget } from "./targets.ts"

const repeats = "20"
const base = process.argv[2] ?? "origin/main"

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" })

const mergeBase = git("merge-base", base, "HEAD").trim()
const diff = git("diff", "-U0", "--diff-filter=d", mergeBase, "--", "*.test.ts", "*.test.tsx")
const targets = repeatTargets(
  [...changedLines(diff)].map(([path, lines]) => ({
    path,
    source: readFileSync(path, "utf8"),
    ...lines,
  })),
)

if (targets.length === 0) {
  console.log(`No test added or changed since ${base}.`)
  process.exit(0)
}

type JsonReport = {
  testResults: { assertionResults: { ancestorTitles: string[]; title: string; status: string }[] }[]
}

const vitest = (args: string[]): { ok: boolean; ran: string[] } => {
  const report = join(mkdtempSync(join(tmpdir(), "ivin-repeat-")), "report.json")
  const run = spawnSync(
    "pnpm",
    [
      "test",
      ...args,
      "--repeats",
      repeats,
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${report}`,
    ],
    { stdio: "inherit" },
  )
  const { testResults } = JSON.parse(readFileSync(report, "utf8")) as JsonReport
  const ran = testResults
    .flatMap((file) => file.assertionResults)
    .filter((test) => test.status === "passed" || test.status === "failed")
    .map((test) => [...test.ancestorTitles, test.title].join(" > "))
  return { ok: run.status === 0, ran }
}

const describeTarget = ({ path, testNames }: FileTarget) =>
  [`  ${path}`, ...testNames.map((name) => `    ${name}`)].join("\n")

const wholeFiles = targets.filter((t) => t.testNames.length === 0)
const someTests = targets.filter((t) => t.testNames.length > 0)
let ok = true

if (wholeFiles.length > 0) {
  console.log(
    `\nRepeating ${repeats} times every test of:\n${wholeFiles.map(describeTarget).join("\n")}`,
  )
  ok = vitest(wholeFiles.map((t) => t.path)).ok && ok
}

if (someTests.length > 0) {
  console.log(
    `\nRepeating ${repeats} times these tests:\n${someTests.map(describeTarget).join("\n")}`,
  )
  const names = someTests.flatMap((t) => t.testNames)
  const result = vitest([...someTests.map((t) => t.path), "-t", `^(?:${names.join("|")})$`])
  const unmatched = names.filter(
    (name) => !result.ran.some((ran) => new RegExp(`^${name}$`).test(ran)),
  )
  if (unmatched.length > 0)
    console.error(
      `\nNo test ran for these names, so they were not repeated:\n  ${unmatched.join("\n  ")}`,
    )
  ok = result.ok && unmatched.length === 0 && ok
}

process.exit(ok ? 0 : 1)
