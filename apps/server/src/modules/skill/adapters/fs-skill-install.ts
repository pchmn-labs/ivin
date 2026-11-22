import type { SkillInstall } from "@ivin/contracts/server"
import { HarnessProvider } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { createHash } from "node:crypto"
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { logError } from "../../log/usecases/log-error.ts"
import { skillInstallStatus } from "../rules/skill-install-status.ts"
import { SkillInstallation } from "../usecases/skill-installation.ts"

export const SKILL_MARKER = ".installed-by-ivin"

interface SkillFile {
  readonly path: string
  readonly content: Uint8Array
}

const filesOf = (folder: string): SkillFile[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return { path: relative(folder, path), content: readFileSync(path) }
    })

const versionOf = (files: readonly SkillFile[]) => {
  const hash = createHash("sha256")
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(`${file.path}\0${file.content.length}\0`).update(file.content)
  }
  return hash.digest("hex").slice(0, 16)
}

const markerOf = (folder: string) => {
  // A link of the skill's name is the user's, even one to a skill ivin wrote.
  if (lstatSync(folder, { throwIfNoEntry: false })?.isSymbolicLink()) return null
  try {
    return readFileSync(join(folder, SKILL_MARKER), "utf8").trim()
  } catch {
    return null
  }
}

const exists = (path: string) => lstatSync(path, { throwIfNoEntry: false }) !== undefined

const removeLeftovers = (skillsFolder: string, prefix: string) => {
  for (const entry of readdirSync(skillsFolder)) {
    if (join(skillsFolder, entry).startsWith(prefix)) {
      rmSync(join(skillsFolder, entry), { recursive: true, force: true })
    }
  }
}

export const installSkill = (
  source: string,
  skillsFolder: string,
): SkillInstall & { readonly cause?: unknown } => {
  const name = basename(source)
  const path = join(skillsFolder, name)
  const stagingPrefix = join(skillsFolder, `.${name}-`)
  let staging: string | null = null
  try {
    const files = filesOf(source)
    const version = versionOf(files)
    if (exists(skillsFolder)) removeLeftovers(skillsFolder, stagingPrefix)
    const status = skillInstallStatus(
      { exists: exists(path), markerVersion: markerOf(path) },
      version,
    )
    if (status === "upToDate" || status === "notOurs") return { name, path, status }

    mkdirSync(skillsFolder, { recursive: true })
    // Written beside the skill, then renamed, so a crash never leaves a half-written skill.
    staging = mkdtempSync(stagingPrefix)
    for (const file of files) {
      mkdirSync(dirname(join(staging, file.path)), { recursive: true })
      writeFileSync(join(staging, file.path), file.content)
    }
    writeFileSync(join(staging, SKILL_MARKER), `${version}\n`)
    if (status === "updated") {
      const previous = `${staging}-previous`
      renameSync(path, previous)
      try {
        renameSync(staging, path)
      } catch (cause) {
        renameSync(previous, path)
        throw cause
      }
      try {
        rmSync(previous, { recursive: true, force: true })
      } catch {
        // The skill is already in place; the next launch removes what is left.
      }
    } else {
      renameSync(staging, path)
    }
    return { name, path, status }
  } catch (cause) {
    if (staging !== null) rmSync(staging, { recursive: true, force: true })
    return { name, path, status: "failed", cause }
  }
}

export const layerFsSkillInstallation = (source: string) =>
  Layer.effect(SkillInstallation)(
    Effect.gen(function* () {
      const { skillsFolder } = yield* HarnessProvider
      if (skillsFolder === null) return null
      const { cause, ...install } = installSkill(source, skillsFolder)
      if (install.status === "failed") {
        yield* logError("skill install", cause)
      } else {
        yield* Effect.logInfo(`the ${install.name} skill at ${install.path}: ${install.status}`)
      }
      return install
    }),
  )
