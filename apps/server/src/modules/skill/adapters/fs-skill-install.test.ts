import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { installSkill, SKILL_MARKER } from "./fs-skill-install.ts"

const tempFolder = () => mkdtempSync(join(tmpdir(), "ivin-skill-"))

const bundledSkill = (files: Record<string, string>) => {
  const source = join(tempFolder(), "ivin-customize")
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(source, path, ".."), { recursive: true })
    writeFileSync(join(source, path), content)
  }
  return source
}

const filesOf = (folder: string) =>
  Object.fromEntries(
    readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name)
        return [path.slice(folder.length + 1), readFileSync(path, "utf8")]
      }),
  )

test("a skill absent from the skills folder is installed there, with ivin's marker", () => {
  const source = bundledSkill({ "SKILL.md": "v1", "docs/cli.md": "cli" })
  const skills = join(tempFolder(), "skills")

  const result = installSkill(source, skills)

  const path = join(skills, "ivin-customize")
  expect(result).toEqual({ name: "ivin-customize", path, status: "installed" })
  expect(filesOf(path)).toMatchObject({ "SKILL.md": "v1", "docs/cli.md": "cli" })
  expect(existsSync(join(path, SKILL_MARKER))).toBe(true)
  expect(readdirSync(skills)).toEqual(["ivin-customize"])
})

test("a skill ivin wrote is replaced when the bundled one changed, and kept when it did not", () => {
  const skills = tempFolder()
  installSkill(bundledSkill({ "SKILL.md": "v1", "old.md": "gone" }), skills)
  const path = join(skills, "ivin-customize")
  const current = bundledSkill({ "SKILL.md": "v2" })

  expect(installSkill(current, skills).status).toBe("updated")
  const updated = filesOf(path)
  expect(updated).toMatchObject({ "SKILL.md": "v2" })
  expect(updated).not.toHaveProperty("old.md")
  expect(readdirSync(skills)).toEqual(["ivin-customize"])

  expect(installSkill(current, skills).status).toBe("upToDate")
  expect(filesOf(path)).toEqual(updated)
})

test("a folder of the skill's name that ivin did not write is left byte for byte", () => {
  const skills = tempFolder()
  const path = join(skills, "ivin-customize")
  mkdirSync(path)
  writeFileSync(join(path, "SKILL.md"), "mine")

  const result = installSkill(bundledSkill({ "SKILL.md": "v1" }), skills)

  expect(result).toEqual({ name: "ivin-customize", path, status: "notOurs" })
  expect(filesOf(path)).toEqual({ "SKILL.md": "mine" })
})

test("a skills folder ivin cannot write to fails the install and leaves nothing behind", () => {
  const skills = tempFolder()
  chmodSync(skills, 0o500)
  try {
    const result = installSkill(bundledSkill({ "SKILL.md": "v1" }), skills)

    expect(result.status).toBe("failed")
    expect(readdirSync(skills)).toEqual([])
  } finally {
    chmodSync(skills, 0o700)
  }
})

test("an install a crash cut short leaves no folder behind once the next one runs", () => {
  const skills = tempFolder()
  mkdirSync(join(skills, ".ivin-customize-abc123"))
  writeFileSync(join(skills, ".ivin-customize-abc123", "SKILL.md"), "half")

  expect(installSkill(bundledSkill({ "SKILL.md": "v1" }), skills).status).toBe("installed")
  expect(readdirSync(skills)).toEqual(["ivin-customize"])
})
