import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { changedLines, repeatTargets } from "./targets.ts"

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

const wholeFiles = targets.filter((t) => t.testNames.length === 0).map((t) => t.path)
const someTests = targets.filter((t) => t.testNames.length > 0)

const run = (label: string, args: string[]) => {
  console.log(`\nRepeating ${repeats} times ${label}`)
  return spawnSync("pnpm", ["test", ...args, "--repeats", repeats], { stdio: "inherit" }).status
}

const statuses = [
  wholeFiles.length > 0 ? run(`every test of:\n  ${wholeFiles.join("\n  ")}`, wholeFiles) : 0,
  someTests.length > 0
    ? run(
        `these tests:\n${someTests.map((t) => `  ${t.path}\n${t.testNames.map((n) => `    ${n}`).join("\n")}`).join("\n")}`,
        [
          ...someTests.map((t) => t.path),
          "-t",
          `^(?:${someTests.flatMap((t) => t.testNames).join("|")})$`,
        ],
      )
    : 0,
]
process.exit(statuses.every((status) => status === 0) ? 0 : 1)
