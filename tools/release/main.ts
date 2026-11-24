// Steps of .github/workflows/release.yml: node tools/release/main.ts <check | sync-version | manifest | notes> …
import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"
import { baseTag, bumpLevel, releaseNotes, manifest, withVersion, type Channel } from "./release.ts"

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim()

const [command, ...args] = process.argv.slice(2)

if (command === "check") {
  const [channel] = args
  if (channel !== "stable" && channel !== "beta") throw new Error("usage: check <stable | beta>")
  // Without the suffix setting, git sorts v0.1.0-beta.0 after v0.1.0.
  const tags = git("-c", "versionsort.suffix=-", "tag", "--list", "v*", "--sort=-v:refname")
    .split("\n")
    .filter(Boolean)
  const tag = baseTag(tags, channel satisfies Channel)
  const subjects = git("log", "--format=%s", tag ? `${tag}..HEAD` : "HEAD")
    .split("\n")
    .filter(Boolean)
  const level = bumpLevel(subjects)
  const release = level !== "none"
  const message = release
    ? `${level} release: ${subjects.length} commits since ${tag ?? "the start"}`
    : `Nothing to release: no feat or fix commit since ${tag ?? "the start"}.`
  console.log(release ? message : `::notice::${message}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `release=${release}\nincrement=${level}\n`)
  }
} else if (command === "sync-version") {
  const [version] = args
  if (!version) throw new Error("usage: sync-version <version>")
  const files = ["package.json"]
  for (const dir of ["apps", "packages"]) {
    for (const name of readdirSync(dir)) {
      if (name !== "plugin-api") files.push(`${dir}/${name}/package.json`)
    }
  }
  for (const file of files) writeFileSync(file, withVersion(readFileSync(file, "utf8"), version))
} else if (command === "manifest") {
  const [version, zip, out] = args
  if (!version || !zip || !out) throw new Error("usage: manifest <version> <zip> <out>")
  writeFileSync(out, manifest(version, basename(zip), readFileSync(zip)))
} else if (command === "notes") {
  const [out] = args
  if (!out) throw new Error("usage: notes <out>")
  writeFileSync(out, releaseNotes(readFileSync("CHANGELOG.md", "utf8")))
} else {
  throw new Error(`unknown command: ${command}`)
}
