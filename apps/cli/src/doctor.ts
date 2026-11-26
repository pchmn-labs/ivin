import type { KeybindingsFileProblem } from "@ivin/contracts/keybinding"
import type { Diagnosis } from "@ivin/contracts/server"
import type { SettingsFileProblem } from "@ivin/contracts/setting"
import { Effect } from "effect"
import type { Command } from "./command.ts"
import { Server } from "./connection.ts"

interface Check {
  readonly check: "app" | "socket" | "settings" | "keybindings" | "harness" | "skill"
  readonly ok: boolean
  readonly message: string
}

const settingsProblem = (problem: SettingsFileProblem) => {
  switch (problem.reason) {
    case "notJson":
      return "is not valid JSON"
    case "notAnObject":
      return "does not hold an object"
    case "invalidSetting":
      return `has an invalid value for "${problem.setting}"`
  }
}

const keybindingsProblem = (problem: KeybindingsFileProblem) => {
  switch (problem.reason) {
    case "notJson":
      return "is not valid JSON"
    case "notAList":
      return "does not hold a list"
    case "invalidEntry":
      return `has an invalid keybinding at entry ${problem.entry}`
  }
}

const fileCheck = <P>(
  check: "settings" | "keybindings",
  file: { readonly path: string; readonly problem: P | null },
  describe: (problem: P) => string,
  kept: string,
): Check =>
  file.problem === null
    ? { check, ok: true, message: `${file.path} is valid or absent` }
    : {
        check,
        ok: false,
        message: `${file.path} ${describe(file.problem)}; ivin uses the last valid ${kept} until it is fixed`,
      }

const harnessCheck = ({ id, program }: Diagnosis["harness"]): Check => {
  if (program === null)
    return { check: "harness", ok: true, message: `The ${id} harness runs no program` }
  return program.path === null
    ? {
        check: "harness",
        ok: false,
        message: `${program.name} is not on the PATH ivin starts agents with; install it, or add its folder to that PATH`,
      }
    : { check: "harness", ok: true, message: `${program.name} found at ${program.path}` }
}

const skillCheck = (skill: Diagnosis["skills"][number]): Check => {
  const { name, path, status } = skill
  switch (status) {
    case "installed":
      return { check: "skill", ok: true, message: `Installed the ${name} skill at ${path}` }
    case "updated":
      return { check: "skill", ok: true, message: `Updated the ${name} skill at ${path}` }
    case "upToDate":
      return { check: "skill", ok: true, message: `The ${name} skill at ${path} is up to date` }
    case "notOurs":
      return {
        check: "skill",
        ok: true,
        message: `${path} is not ivin's: ivin left it as it is. Remove it to get ivin's ${name} skill at the next launch`,
      }
    case "failed":
      return {
        check: "skill",
        ok: false,
        message: `Could not install the ${name} skill at ${path}; the error is in ~/.ivin/logs/ivin.log`,
      }
  }
}

const skillChecks = (diagnosis: Diagnosis): readonly Check[] =>
  diagnosis.skills.length === 0
    ? [
        {
          check: "skill",
          ok: true,
          message: `The ${diagnosis.harness.id} harness takes no skills`,
        },
      ]
    : diagnosis.skills.map(skillCheck)

export const checksOf = (diagnosis: Diagnosis, socketPath: string): readonly Check[] => [
  { check: "app", ok: true, message: `ivin ${diagnosis.version} is running` },
  { check: "socket", ok: true, message: `Answering on ${socketPath}` },
  fileCheck("settings", diagnosis.settings, settingsProblem, "settings"),
  fileCheck("keybindings", diagnosis.keybindings, keybindingsProblem, "keybindings"),
  harnessCheck(diagnosis.harness),
  ...skillChecks(diagnosis),
]

export const doctor: Command = {
  name: "doctor",
  summary: "Check that ivin, its files and the agent's program are healthy",
  usage: "ivin doctor [--json]",
  description:
    "Prints one line per check: the app's version, the socket, settings.json, keybindings.json, the program the agents run and the install of ivin's skills for them. Exits 1 when a check fails.",
  options: {},
  maxArguments: 0,
  run: () =>
    Effect.gen(function* () {
      const { client, socketPath } = yield* Server
      const checks = checksOf(yield* client["server.doctor"](), socketPath)
      const ok = checks.every((check) => check.ok)
      return {
        ok,
        text: checks.map((check) => `${check.ok ? "✓" : "✗"} ${check.message}`).join("\n"),
        json: { checks },
      }
    }).pipe(Effect.orDie),
}
