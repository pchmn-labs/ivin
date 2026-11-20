import type { KeybindingsFileProblem } from "@ivin/contracts/keybinding"
import type { Diagnosis } from "@ivin/contracts/server"
import type { SettingsFileProblem } from "@ivin/contracts/setting"
import { Effect } from "effect"
import type { Command } from "./command.ts"
import { Server } from "./connection.ts"

interface Check {
  readonly check: "app" | "socket" | "settings" | "keybindings" | "harness"
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

export const checksOf = (diagnosis: Diagnosis, socketPath: string): readonly Check[] => [
  { check: "app", ok: true, message: `ivin ${diagnosis.version} is running` },
  { check: "socket", ok: true, message: `Answering on ${socketPath}` },
  fileCheck("settings", diagnosis.settings, settingsProblem, "settings"),
  fileCheck("keybindings", diagnosis.keybindings, keybindingsProblem, "keybindings"),
  harnessCheck(diagnosis.harness),
]

export const doctor: Command = {
  name: "doctor",
  summary: "Check that ivin, its files and the agent's program are healthy",
  usage: "ivin doctor [--json]",
  description:
    "Prints one line per check: the app's version, the socket, settings.json, keybindings.json and the program the agents run. Exits 1 when a check fails.",
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
