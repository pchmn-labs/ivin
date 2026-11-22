import type { SkillInstall } from "@ivin/contracts/server"
import { HarnessProvider } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { createHash } from "node:crypto"
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, relative } from "node:path"
import { logError } from "../../log/usecases/log-error.ts"
import { skillInstallAction } from "../rules/skill-install-action.ts"
import { SkillInstallation } from "../usecases/skill-installation.ts"

export const SKILL_MARKER = ".installed-by-ivin"

interface SkillFile {
  readonly path: string
  readonly content: Uint8Array
}

const statuses = {
  install: "installed",
  update: "updated",
  keep: "upToDate",
  leave: "notOurs",
} as const

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
  try {
    return readFileSync(join(folder, SKILL_MARKER), "utf8").trim()
  } catch {
    return null
  }
}

const exists = (path: string) => statSync(path, { throwIfNoEntry: false }) !== undefined

// Copies the bundled skill folder `source` into `skillsFolder`, unless a folder of its name there is not ivin's.
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
    const action = skillInstallAction({ exists: exists(path), marker: markerOf(path) }, version)
    if (action === "keep" || action === "leave") return { name, path, status: statuses[action] }

    mkdirSync(skillsFolder, { recursive: true })
    for (const entry of readdirSync(skillsFolder)) {
      if (join(skillsFolder, entry).startsWith(stagingPrefix)) {
        rmSync(join(skillsFolder, entry), { recursive: true, force: true })
      }
    }
    // Written beside the skill, then renamed, so a crash never leaves a half-written skill.
    staging = mkdtempSync(stagingPrefix)
    for (const file of files) {
      mkdirSync(dirname(join(staging, file.path)), { recursive: true })
      writeFileSync(join(staging, file.path), file.content)
    }
    writeFileSync(join(staging, SKILL_MARKER), `${version}\n`)
    if (action === "update") {
      const previous = `${staging}-previous`
      renameSync(path, previous)
      renameSync(staging, path)
      rmSync(previous, { recursive: true, force: true })
    } else {
      renameSync(staging, path)
    }
    return { name, path, status: statuses[action] }
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
