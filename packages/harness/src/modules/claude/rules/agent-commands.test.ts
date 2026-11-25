import { expect, test } from "vitest"
import backgroundCommand from "./fixtures/background-command.jsonl?raw"
import initialize from "./fixtures/initialize.jsonl?raw"
import {
  agentCommands,
  commandEntriesFromInitialize,
  commandsOfRun,
  initialFacts,
  runListsSameNames,
} from "./agent-commands.ts"

const response = JSON.parse(initialize.trim()) as unknown
const runInit = backgroundCommand
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { type: string; subtype?: string })
  .find((line) => line.type === "system" && line.subtype === "init")

// The shape Claude Code 2.1 gives a project's skill, which the recorded account has none of.
const projectSkill = {
  name: "probe-skill",
  description: "A probe skill. (project)",
  argumentHint: "[thing]",
}

const withEntry = (entry: unknown) => {
  const line = structuredClone(response) as {
    response: { response: { commands: unknown[] } }
  }
  line.response.response.commands.push(entry)
  return line
}

test("a line that is not the response to the request lists nothing", () => {
  expect(commandEntriesFromInitialize(response, "other")).toBeUndefined()
  expect(commandEntriesFromInitialize(runInit, "init")).toBeUndefined()
})

test("Claude's commands come with their description and argument hint", () => {
  const commands = agentCommands(commandEntriesFromInitialize(response, "init")!, initialFacts)
  expect(commands.find((command) => command.name === "model")).toEqual({
    name: "model",
    description: expect.any(String),
    argumentHint: "<model>",
    kind: "command",
    source: null,
  })
  expect(commands.find((command) => command.name === "init")?.argumentHint).toBeNull()
})

test("a project's skill is a skill from the project, with its argument hint", () => {
  const entries = commandEntriesFromInitialize(withEntry(projectSkill), "init")!
  expect(agentCommands(entries, initialFacts)).toContainEqual({
    name: "probe-skill",
    description: "A probe skill.",
    argumentHint: "[thing]",
    kind: "skill",
    source: "project",
  })
})

test.each([
  [{ name: "retro", description: "Run a retro. (user)" }, "user", "Run a retro."],
  [{ name: "pdf", description: "Read PDFs. (claude.ai sync)" }, "user", "Read PDFs."],
  [
    { name: "skill-creator:skill-creator", description: "(skill-creator) Create skills." },
    "plugin",
    "Create skills.",
  ],
])("a skill whose description says where it comes from: %o", (entry, source, description) => {
  const [command] = agentCommands([{ ...entry, argumentHint: "" }], initialFacts)
  expect(command).toMatchObject({ kind: "skill", source, description })
})

test("a built-in skill comes from Claude", () => {
  const run = commandsOfRun(runInit)!
  const commands = agentCommands(commandEntriesFromInitialize(response, "init")!, run.facts)
  expect(commands.find((command) => command.name === "dataviz")?.source).toBe("built-in")
})

test("terminal-only, internal and removed commands are left out", () => {
  const names = agentCommands(commandEntriesFromInitialize(response, "init")!, initialFacts).map(
    (command) => command.name,
  )
  expect(names).not.toContain("doctor")
  expect(names).not.toContain("color")
  expect(names).not.toContain("__remote-workflow")
  expect(names).not.toContain("agents")
  expect(names).toContain("compact")
})

test("a run's first line says which built-in commands are skills", () => {
  const run = commandsOfRun(runInit)!
  const commands = agentCommands(commandEntriesFromInitialize(response, "init")!, run.facts)
  expect(commands.find((command) => command.name === "dataviz")?.kind).toBe("skill")
  expect(commands.find((command) => command.name === "compact")?.kind).toBe("command")
})

test("a run lists the same names as the initialize response, until a skill is added", () => {
  const run = commandsOfRun(runInit)!
  const entries = commandEntriesFromInitialize(response, "init")!
  expect(runListsSameNames(entries, run)).toBe(true)
  expect(runListsSameNames(entries, { ...run, names: [...run.names, "probe-skill"] })).toBe(false)
})

test("a line other than a run's first line carries no command list", () => {
  expect(commandsOfRun(response)).toBeUndefined()
})
