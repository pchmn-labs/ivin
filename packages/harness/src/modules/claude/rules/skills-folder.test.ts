import { expect, test } from "vitest"
import { claudeSkillsFolder } from "./skills-folder.ts"

test("Claude reads the user's skills from ~/.claude/skills", () => {
  expect(claudeSkillsFolder({}, "/home/me")).toBe("/home/me/.claude/skills")
})

test("Claude reads the user's skills from CLAUDE_CONFIG_DIR when it is set", () => {
  expect(claudeSkillsFolder({ CLAUDE_CONFIG_DIR: "/config/claude" }, "/home/me")).toBe(
    "/config/claude/skills",
  )
  expect(claudeSkillsFolder({ CLAUDE_CONFIG_DIR: "/config/claude/" }, "/home/me")).toBe(
    "/config/claude/skills",
  )
  expect(claudeSkillsFolder({ CLAUDE_CONFIG_DIR: "" }, "/home/me")).toBe("/home/me/.claude/skills")
})
