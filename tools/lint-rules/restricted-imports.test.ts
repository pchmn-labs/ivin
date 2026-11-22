import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const adr = "docs/adr/0001-code-grouped-by-subject-and-layered-by-test.md"
const sandbox = mkdtempSync(join(tmpdir(), "ivin-lint-"))

// Same overrides as the repo config; overrides globs resolve from the config's folder, so it is copied beside the fixtures.
const { ignorePatterns: _ignored, ...config } = JSON.parse(
  readFileSync(join(root, ".oxlintrc.json"), "utf8"),
)
writeFileSync(join(sandbox, ".oxlintrc.json"), JSON.stringify(config))

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

type Diagnostic = { code: string; message: string; help?: string; filename: string }

// One lint run for every fixture: a run per case costs about a second under load.
const lintOutput = new Map<string, string[]>()
const fixturePath = new Map<string, string>()
const lintAll = (cases: [string, string, string][]) => {
  const paths = cases.map(([file, , source], i) => {
    const path = join(sandbox, file.replace(/(\.\w+)$/, `-${i}$1`))
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
    return path
  })
  const run = spawnSync(
    join(root, "node_modules/.bin/vp"),
    ["lint", "-c", join(sandbox, ".oxlintrc.json"), "-f", "json", ...paths],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  )
  const { diagnostics } = JSON.parse(run.stdout) as { diagnostics: Diagnostic[] }
  paths.forEach((path, i) => {
    fixturePath.set(`${cases[i]![0]}|${cases[i]![1]}`, path)
    lintOutput.set(
      path,
      diagnostics
        .filter((d) => d.code === "eslint(no-restricted-imports)" && d.filename === path)
        .map((d) => `${d.message} ${d.help ?? ""}`),
    )
  })
}

const forbidden: [string, string, string][] = [
  [
    "modules/session/rules/a.ts",
    "node:fs",
    `import { readFileSync } from "node:fs"\nexport const a = readFileSync\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "effect",
    `import { Effect } from "effect"\nexport const a = Effect\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "effect submodule",
    `import { Layer } from "effect/Layer"\nexport const a = Layer\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "electron",
    `import { app } from "electron"\nexport const a = app\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "react",
    `import { useState } from "react"\nexport const a = useState\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "adapters",
    `import { a } from "../adapters/db.ts"\nexport { a }\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "usecases",
    `import { a } from "../usecases/send.ts"\nexport { a }\n`,
  ],
  ["modules/session/rules/a.ts", "atoms", `import { a } from "../atoms/send.ts"\nexport { a }\n`],
  ["modules/session/rules/a.ts", "hooks", `import { a } from "../hooks/send.ts"\nexport { a }\n`],
  ["modules/session/rules/a.ts", "ui", `import { a } from "../ui/send.tsx"\nexport { a }\n`],
  [
    "modules/session/usecases/a.ts",
    "node:path",
    `import { join } from "node:path"\nexport const a = join\n`,
  ],
  [
    "modules/session/usecases/a.ts",
    "electron",
    `import { app } from "electron"\nexport const a = app\n`,
  ],
  [
    "modules/session/usecases/a.ts",
    "adapters",
    `import { a } from "../adapters/db.ts"\nexport { a }\n`,
  ],
  [
    "modules/session/atoms/a.ts",
    "node:fs",
    `import { readFileSync } from "node:fs"\nexport const a = readFileSync\n`,
  ],
  [
    "modules/session/atoms/a.ts",
    "adapters",
    `import { a } from "../adapters/db.ts"\nexport { a }\n`,
  ],
  [
    "modules/session/atoms/a.ts",
    "react",
    `import { useState } from "react"\nexport const a = useState\n`,
  ],
  ["modules/session/atoms/a.ts", "hooks", `import { a } from "../hooks/send.ts"\nexport { a }\n`],
  ["modules/session/atoms/a.ts", "ui", `import { a } from "../ui/send.tsx"\nexport { a }\n`],
  ["plugins/demo/src/index.ts", "another package", `import _ from "lodash"\nexport const a = _\n`],
  [
    "plugins/demo/src/ui.tsx",
    "node:fs",
    `import { readFileSync } from "node:fs"\nexport const a = readFileSync\n`,
  ],
  [
    "plugins/demo/src/ui.tsx",
    "contracts",
    `import type { UsageItem } from "@ivin/contracts/transcript"\nexport type A = UsageItem\n`,
  ],
  [
    "plugins/demo/src/ui.tsx",
    "ui",
    `import { Button } from "@ivin/ui/button"\nexport const a = Button\n`,
  ],
  [
    "plugins/demo/src/ui.tsx",
    "an effect package",
    `import { useAtomValue } from "@effect/atom-react"\nexport const a = useAtomValue\n`,
  ],
]

const allowed: [string, string, string][] = [
  [
    "modules/session/rules/a.ts",
    "effect/Schema",
    `import { Schema } from "effect/Schema"\nexport const a = Schema\n`,
  ],
  [
    "modules/session/rules/a.ts",
    "a type from contracts",
    `import type { ServerVersion } from "@ivin/contracts/server"\nexport type A = ServerVersion\n`,
  ],
  [
    "modules/session/usecases/a.ts",
    "effect",
    `import { Effect } from "effect"\nexport const a = Effect\n`,
  ],
  [
    "modules/session/atoms/a.ts",
    "effect",
    `import { Effect } from "effect"\nexport const a = Effect\n`,
  ],
  [
    "plugins/demo/src/index.ts",
    "the plugin api",
    `import { definePlugin } from "@ivin/plugin-api"\nexport const a = definePlugin\n`,
  ],
  [
    "plugins/demo/src/index.ts",
    "react",
    `import { useState } from "react"\nexport const a = useState\n`,
  ],
  [
    "plugins/demo/src/ui.tsx",
    "a plugin api subpath",
    `import { Text } from "@ivin/plugin-api/ui"\nexport const a = Text\n`,
  ],
  [
    "plugins/demo/src/ui.tsx",
    "a react subpath",
    `import { jsx } from "react/jsx-runtime"\nexport const a = jsx\n`,
  ],
  ["plugins/demo/src/index.ts", "its own files", `import { a } from "./util.ts"\nexport { a }\n`],
]

const restrictedImports = (file: string, what: string): string[] =>
  lintOutput.get(fixturePath.get(`${file}|${what}`)!)!

describe("restricted imports", () => {
  beforeAll(() => lintAll([...forbidden, ...allowed]))

  test("a file under rules/ importing node:fs fails with a message citing ADR-0001", () => {
    const [message] = restrictedImports(forbidden[0]![0], forbidden[0]![1])
    expect(message).toContain(adr)
  })

  test.each(forbidden)("%s may not import %s", (file, what) => {
    const messages = restrictedImports(file, what)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(adr)
  })

  test.each(allowed)("%s may import %s", (file, what) => {
    expect(restrictedImports(file, what)).toEqual([])
  })
})
