import { Effect } from "effect"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"
import {
  bundlePath,
  importBundle,
  listPlugins,
  packageJson,
  readLog,
  tempDir,
  withServer,
  writePlugin,
} from "./plugin-test-server.ts"

// Rolldown starts its native binding on the first compile.
vi.setConfig({ testTimeout: 20_000 })

const greeter = {
  "package.json": packageJson({ id: "greeter", name: "Greeter", ui: "src/ui.tsx" }),
  "src/answer.ts": "export const answer = (n: number) => n * 2\n",
  "src/ui.tsx": `import { useState } from "react"
import { defineUi } from "@ivin/plugin-api/ui"
import { answer } from "./answer.ts"

export function Counter() {
  const [count] = useState(20)
  return <span>count {answer(count)}</span>
}

export const activate = defineUi((ctx) => {
  ctx.commands.register("greeter.answer", { title: "Answer", run: () => answer(21) })
})
`,
}

test("a plugin's UI half compiles into a bundle whose command returns its value and whose component uses the host's React", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter)

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({ _tag: "compiled", id: "greeter", name: "Greeter" })

  const bundle = await importBundle(bundlePath(home, plugin))
  const commands = new Map<string, () => unknown>()
  ;(bundle["activate"] as (ctx: unknown) => void)({
    commands: { register: (id: string, { run }: { run: () => unknown }) => commands.set(id, run) },
  })
  expect(commands.get("greeter.answer")?.()).toBe(42)
  // A second React would throw on useState here.
  expect(renderToString(React.createElement(bundle["Counter"] as React.FC))).toBe(
    "<span>count <!-- -->40</span>",
  )
})

test("a plugin's UI half bundles the components and hooks it imports from src/ui and src/hooks", async () => {
  const home = tempDir("home")
  writePlugin(home, "split", {
    "package.json": packageJson({ id: "split", name: "Split", ui: "src/ui.tsx" }),
    "src/hooks/use-answer.ts": "export const useAnswer = () => 42\n",
    "src/ui/answer.tsx":
      'import { useAnswer } from "../hooks/use-answer.ts"\nexport const Answer = () => <span>{useAnswer()}</span>\n',
    "src/ui.tsx": 'export { Answer } from "./ui/answer.tsx"\nexport const activate = () => {}\n',
  })

  const [plugin] = await listPlugins(home)
  expect(plugin).toMatchObject({ _tag: "compiled", id: "split" })
  const bundle = await importBundle(bundlePath(home, plugin))
  expect(renderToString(React.createElement(bundle["Answer"] as React.FC))).toBe("<span>42</span>")
})

test("an unchanged plugin is not compiled again, and a changed one is", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter)
  const first = bundlePath(home, (await listPlugins(home))[0])
  writeFileSync(first, "// kept from the first load\n")

  expect(bundlePath(home, (await listPlugins(home))[0])).toBe(first)
  expect(readFileSync(first, "utf8")).toBe("// kept from the first load\n")

  writePlugin(home, "greeter", { "src/answer.ts": "export const answer = (n: number) => n * 3\n" })
  expect(bundlePath(home, (await listPlugins(home))[0])).not.toBe(first)
})

test.each([
  ["has no package.json", "broken", { "src/ui.tsx": "" }, "broken", "no package.json"],
  [
    "has an invalid manifest",
    "broken",
    { "package.json": packageJson({ id: "Broken!", ui: "src/ui.tsx" }) },
    "broken",
    "ivin.id",
  ],
  [
    "does not compile",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx": "export const activate = (",
    },
    "broken",
    "Could not compile src/ui.tsx",
  ],
  [
    "imports a package ivin does not provide",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx":
        'import { renderToString } from "react-dom/server"\nexport const activate = renderToString\n',
    },
    "broken",
    "react-dom/server, which ivin does not provide",
  ],
  [
    "imports an npm package",
    "broken",
    {
      "package.json": packageJson({ id: "broken", ui: "src/ui.tsx" }),
      "src/ui.tsx": 'import pad from "left-pad"\nexport const activate = pad\n',
    },
    "broken",
    "It imports left-pad",
  ],
  [
    "names an entry outside its folder",
    "broken",
    { "package.json": packageJson({ id: "broken", ui: "../greeter/src/ui.tsx" }) },
    "broken",
    "leads out of the plugin's folder",
  ],
  [
    "reuses another plugin's id",
    "other",
    { ...greeter, "package.json": packageJson({ id: "greeter", ui: "src/ui.tsx" }) },
    "greeter",
    "The folder greeter already holds",
  ],
])(
  "a plugin that %s is failed with its reason in its log, and the others still load",
  async (_, folder, files, id, reason) => {
    const home = tempDir("home")
    writePlugin(home, "greeter", greeter)
    writePlugin(home, folder, files)

    const plugins = await listPlugins(home)
    expect(plugins.find((p) => p._tag === "compiled")?.id).toBe("greeter")
    const failed = plugins.find((p) => p._tag === "failed")
    expect(failed).toMatchObject({ id, reason: expect.stringContaining(reason) })
    expect(await readLog(home, id)).toEqual([expect.stringContaining(reason)])
  },
)

test("a failure the window reports is added to the plugin's log, newest last", async () => {
  const home = tempDir("home")
  const lines = await withServer(home, (client) =>
    Effect.gen(function* () {
      yield* client["plugin.reportFailure"]({ id: "greeter", reason: "activate threw: first" })
      yield* client["plugin.reportFailure"]({ id: "greeter", reason: "activate threw: second" })
      return yield* client["plugin.readLog"]({ id: "greeter" })
    }),
  )
  expect(lines).toEqual([
    expect.stringMatching(/^\d{4}-\d\d-\d\dT.* activate threw: first$/),
    expect.stringMatching(/activate threw: second$/),
  ])
})

test("with no plugins folder, no plugin loads and a log reads empty", async () => {
  const home = tempDir("home")
  expect(await listPlugins(home)).toEqual([])
  expect(await readLog(home, "../../etc/passwd")).toEqual([])
})

test("a log that cannot be written leaves plugin.list answering", async () => {
  const home = tempDir("home")
  writePlugin(home, "greeter", greeter)
  writePlugin(home, "broken", { "package.json": "not json" })
  writeFileSync(join(home, "logs"), "a file where the log folder should be")

  const plugins = await listPlugins(home)
  expect(plugins.map((p) => p._tag).sort()).toEqual(["compiled", "failed"])
})
