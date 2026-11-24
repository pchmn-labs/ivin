import type { Diagnosis } from "@ivin/contracts/server"
import { defaultSettings } from "@ivin/contracts/setting"
import { HarnessProvider } from "@ivin/harness"
import { Effect, Option, Stream } from "effect"
import { readKeybindingsFile } from "../../keybinding/rules/read-keybindings-file.ts"
import { KeybindingsFile } from "../../keybinding/usecases/keybindings-file.ts"
import { readSettingsFile } from "../../setting/rules/read-settings-file.ts"
import { SettingsFile } from "../../setting/usecases/settings-file.ts"
import { SkillInstallation } from "../../skill/usecases/skill-installation.ts"
import { ServerInfo } from "./server-info.ts"

const currentText = (contents: Stream.Stream<string | null>) =>
  Stream.runHead(contents).pipe(Effect.map(Option.getOrNull))

export const doctor = Effect.gen(function* () {
  const { version } = yield* ServerInfo
  const settingsFile = yield* SettingsFile
  const keybindingsFile = yield* KeybindingsFile
  const harness = yield* HarnessProvider
  const skill = yield* SkillInstallation
  const [settingsText, keybindingsText, program] = yield* Effect.all(
    [currentText(settingsFile.contents), currentText(keybindingsFile.contents), harness.program],
    { concurrency: "unbounded" },
  )
  const diagnosis: Diagnosis = {
    version,
    settings: {
      path: settingsFile.path,
      problem: readSettingsFile(
        { settings: defaultSettings, problem: null },
        settingsText,
        defaultSettings,
      ).problem,
    },
    keybindings: {
      path: keybindingsFile.path,
      problem: readKeybindingsFile({ keybindings: [], problem: null }, keybindingsText).problem,
    },
    harness: { id: harness.id, program },
    skill,
  }
  return diagnosis
})
