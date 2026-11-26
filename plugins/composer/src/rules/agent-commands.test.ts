import type { AgentCommand } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { commandTag, rankCommands } from "./agent-commands.ts"

const skill = (name: string, source: AgentCommand["source"] = "user"): AgentCommand => ({
  name,
  description: `Does ${name}`,
  argumentHint: null,
  kind: "skill",
  source,
})
const command = (name: string): AgentCommand => ({ ...skill(name), kind: "command", source: null })

const names = (ranked: ReturnType<typeof rankCommands>) => ranked.map((r) => r.command.name)

test("with no letters, the project's skills come first and Claude's commands last", () => {
  const ranked = rankCommands(
    [
      command("compact"),
      skill("retro"),
      skill("dataviz", "built-in"),
      skill("implement", "project"),
    ],
    "",
  )
  expect(names(ranked)).toEqual(["implement", "retro", "dataviz", "compact"])
})

test("letters narrow the list to the names that hold them, tightest and earliest first", () => {
  const ranked = rankCommands(
    [
      skill("code-review", "project"),
      skill("review-animations"),
      command("review"),
      command("compact"),
    ],
    "rev",
  )
  expect(names(ranked)).toEqual(["review", "review-animations", "code-review"])
  expect(ranked[2]?.match).toEqual([5, 6, 7])
})

test("letters apart still match, after the runs side by side", () => {
  expect(names(rankCommands([skill("rate-view"), skill("review")], "rv"))).toEqual([
    "review",
    "rate-view",
  ])
  expect(rankCommands([skill("review")], "xyz")).toEqual([])
})

test("a tag says what it is and where a skill comes from, the project by its name", () => {
  expect(commandTag(skill("implement", "project"), "ivin")).toBe("Ivin skill")
  expect(commandTag(skill("retro"), "ivin")).toBe("User skill")
  expect(commandTag(skill("x", "plugin"), "ivin")).toBe("Plugin skill")
  expect(commandTag(skill("dataviz", "built-in"), "ivin")).toBe("Built-in skill")
  expect(commandTag(command("compact"), "ivin")).toBe("Command")
})
