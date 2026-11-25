import { Effect, Stream } from "effect"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { beforeAll, expect, test } from "vitest"
import { defaultSettings, type Settings } from "@ivin/contracts/setting"
import { readSettingsFile } from "../modules/setting/rules/read-settings-file.ts"
import { CurrentSettings } from "../modules/setting/usecases/current-settings.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

const text = `{
    // Keep agents running when their tab closes.
    "worktrees": { "removeOnTabClose": true }, /* left alone */
    "tabs": {
        "stopAgentOnClose": true,
    },
}
`

// Runs `ivin settings …` while the app watches a settings.json holding `initial`.
const settings = (args: readonly string[], initial: string | null = text, readOnlyHome = false) => {
  const home = join(mkdtempSync(join(tmpdir(), "ivin-home-")), ".ivin")
  mkdirSync(home)
  const path = join(home, "settings.json")
  if (initial !== null) writeFileSync(path, initial)
  if (readOnlyHome) chmodSync(home, 0o500)
  return withCliServer(
    async (socketPath, run) => {
      const loaded = readSettingsFile(
        { settings: defaultSettings, problem: null },
        initial,
        defaultSettings,
      )
      const firstSettings = (matches: (settings: Settings) => boolean) =>
        run(
          Effect.gen(function* () {
            return yield* (yield* CurrentSettings).changes.pipe(
              Stream.map(({ settings }) => settings),
              Stream.filter(matches),
              Stream.runHead,
              Effect.timeout("2 seconds"),
            )
          }),
        )
      // `get` answers with what the app has read, so the app must have read the file first.
      await firstSettings((settings) => isDeepStrictEqual(settings, loaded.settings))
      const result = await runCli(["settings", ...args], { IVIN_SOCKET: socketPath })
      const applied =
        args[0] === "set" && result.code === 0
          ? await firstSettings((settings) => !isDeepStrictEqual(settings, loaded.settings))
          : undefined
      return {
        ...result,
        file: existsSync(path) ? readFileSync(path, "utf8") : null,
        applied: applied?._tag === "Some" ? applied.value : undefined,
      }
    },
    { ivinHome: home },
  )
}

test("ivin settings set changes only that value in the file, and the app applies it", async () => {
  const run = await settings(["set", "tabs.stopAgentOnClose", "false"])

  expect(run.code).toBe(0)
  expect(run.stdout).toBe("tabs.stopAgentOnClose is now false.\n")
  expect(run.file).toBe(text.replace('"stopAgentOnClose": true', '"stopAgentOnClose": false'))
  expect(run.applied).toEqual({
    tabs: { stopAgentOnClose: false, newTabPosition: "end" },
    worktrees: { removeOnTabClose: true },
    files: { folderIcons: true },
    sidebar: { layout: "rail" },
    agents: { stopWhenIdleMinutes: 10 },
    updates: { automaticCheck: true, beta: false },
  })
}, 10_000)

test("an unknown setting exits 1 with the known ones, and the file is untouched", async () => {
  const run = await settings(["set", "tabs.nope", "true"])

  expect(run.code).toBe(1)
  expect(run.stderr).toContain('No setting is named "tabs.nope"')
  expect(run.stderr).toContain(
    "tabs.stopAgentOnClose, tabs.newTabPosition, worktrees.removeOnTabClose, files.folderIcons",
  )
  expect(run.file).toBe(text)
}, 10_000)

test("a value of the wrong type exits 1 with the type expected, and the file is untouched", async () => {
  const run = await settings(["set", "tabs.stopAgentOnClose", "maybe"])

  expect(run.code).toBe(1)
  expect(run.stderr).toContain('tabs.stopAgentOnClose takes true or false, not "maybe"')
  expect(run.file).toBe(text)
}, 10_000)

test("a setting with fixed values names them when given another one", async () => {
  const run = await settings(["set", "sidebar.layout", "column"])

  expect(run.code).toBe(1)
  expect(run.stderr).toContain('sidebar.layout takes "rail" or "strip", not "column"')
  expect(run.file).toBe(text)
}, 10_000)

test("a settings.json that is not JSON exits 1 with its parse error, and is untouched", async () => {
  const broken = `{\n  "tabs": {}\n  "worktrees": {}\n}`
  const run = await settings(["set", "tabs.stopAgentOnClose", "false"], broken)

  expect(run.code).toBe(1)
  expect(run.stderr).toContain("is not valid JSON: CommaExpected at line 3, column 3")
  expect(run.file).toBe(broken)
}, 10_000)

test("on a missing settings.json, ivin settings set creates it with only that value", async () => {
  const run = await settings(["set", "tabs.stopAgentOnClose", "false"], null)

  expect(run.code).toBe(0)
  expect(run.file).toBe(`{\n  "tabs": {\n    "stopAgentOnClose": false\n  }\n}\n`)
}, 10_000)

test("a missing value or path is invalid usage", async () => {
  const run = await settings(["set", "tabs.stopAgentOnClose"])

  expect(run.code).toBe(2)
  expect(run.stderr).toContain("ivin settings set needs a setting and a value")
  expect(run.file).toBe(text)
}, 10_000)

test("ivin settings get prints every setting, or the one at a path", async () => {
  const all = await settings(["get"])
  const one = await settings(["get", "worktrees.removeOnTabClose"])
  const section = await settings(["get", "tabs"])
  const unknown = await settings(["get", "nope"])

  expect(all.code).toBe(0)
  expect(all.stdout).toBe(
    'tabs.stopAgentOnClose = true\ntabs.newTabPosition = "end"\nworktrees.removeOnTabClose = true\nfiles.folderIcons = true\nsidebar.layout = "rail"\nagents.stopWhenIdleMinutes = 10\nupdates.automaticCheck = true\nupdates.beta = false\n',
  )
  expect(one.stdout).toBe("true\n")
  expect(section.stdout).toBe('tabs.stopAgentOnClose = true\ntabs.newTabPosition = "end"\n')
  expect(unknown.code).toBe(1)
  expect(unknown.stderr).toContain('No setting is named "nope"')
}, 10_000)

test("--json prints the values as JSON", async () => {
  const all = await settings(["get", "--json"], `{ "tabs": { "stopAgentOnClose": false } }`)
  const one = await settings(["get", "tabs.stopAgentOnClose", "--json"])
  const set = await settings(["set", "tabs.stopAgentOnClose", "false", "--json"])

  expect(JSON.parse(all.stdout)).toEqual({
    ok: true,
    path: null,
    value: {
      tabs: { stopAgentOnClose: false, newTabPosition: "end" },
      worktrees: { removeOnTabClose: true },
      files: { folderIcons: true },
      sidebar: { layout: "rail" },
      agents: { stopWhenIdleMinutes: 10 },
      updates: { automaticCheck: true, beta: false },
    },
  })
  expect(JSON.parse(one.stdout)).toEqual({ ok: true, path: "tabs.stopAgentOnClose", value: true })
  expect(JSON.parse(set.stdout)).toEqual({ ok: true, path: "tabs.stopAgentOnClose", value: false })
}, 10_000)

test("ivin settings set tells when the file cannot be written", async () => {
  const run = await settings(["set", "tabs.stopAgentOnClose", "false"], null, true)

  expect(run.code).toBe(1)
  expect(run.stderr).toContain("ivin could not write")
})
