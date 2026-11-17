import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

const root = resolve(import.meta.dirname, "../..")
const adr = "docs/adr/0001-code-grouped-by-subject-and-layered-by-test.md"
const sandbox = mkdtempSync(join(tmpdir(), "ivin-lint-"))

// Same overrides as the repo config; overrides globs resolve from the config's folder, so it is copied beside the fixtures.
const { ignorePatterns: _ignored, ...config } = JSON.parse(
  readFileSync(join(root, ".oxlintrc.json"), "utf8"),
)
writeFileSync(join(sandbox, ".oxlintrc.json"), JSON.stringify(config))

afterAll(() => rmSync(sandbox, { recursive: true, force: true }))

const restrictedImports = (file: string, source: string): string[] => {
  const path = join(sandbox, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, source)
  const run = spawnSync(
    join(root, "node_modules/.bin/vp"),
    ["lint", "-c", join(sandbox, ".oxlintrc.json"), "-f", "json", path],
    { encoding: "utf8" },
  )
  const { diagnostics } = JSON.parse(run.stdout) as {
    diagnostics: { code: string; message: string; help?: string }[]
  }
  return diagnostics
    .filter((d) => d.code === "eslint(no-restricted-imports)")
    .map((d) => `${d.message} ${d.help ?? ""}`)
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
  ["plugins/demo/index.ts", "another package", `import _ from "lodash"\nexport const a = _\n`],
  [
    "plugins/demo/ui.tsx",
    "node:fs",
    `import { readFileSync } from "node:fs"\nexport const a = readFileSync\n`,
  ],
  [
    "plugins/demo/ui.tsx",
    "contracts",
    `import type { UsageItem } from "@ivin/contracts/transcript"\nexport type A = UsageItem\n`,
  ],
  [
    "plugins/demo/ui.tsx",
    "ui",
    `import { Button } from "@ivin/ui/button"\nexport const a = Button\n`,
  ],
  [
    "plugins/demo/ui.tsx",
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
    "plugins/demo/index.ts",
    "the plugin api",
    `import { definePlugin } from "@ivin/plugin-api"\nexport const a = definePlugin\n`,
  ],
  [
    "plugins/demo/index.ts",
    "react",
    `import { useState } from "react"\nexport const a = useState\n`,
  ],
  [
    "plugins/demo/ui.tsx",
    "a plugin api subpath",
    `import { Text } from "@ivin/plugin-api/ui"\nexport const a = Text\n`,
  ],
  [
    "plugins/demo/ui.tsx",
    "a react subpath",
    `import { jsx } from "react/jsx-runtime"\nexport const a = jsx\n`,
  ],
  ["plugins/demo/index.ts", "its own files", `import { a } from "./util.ts"\nexport { a }\n`],
]

describe("restricted imports", () => {
  test("a file under rules/ importing node:fs fails with a message citing ADR-0001", () => {
    const [message] = restrictedImports("modules/session/rules/node-fs.ts", forbidden[0]![2])
    expect(message).toContain(adr)
  })

  test.each(forbidden)("%s may not import %s", (file, _what, source) => {
    const messages = restrictedImports(file, source)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(adr)
  })

  test.each(allowed)("%s may import %s", (file, _what, source) => {
    expect(restrictedImports(file, source)).toEqual([])
  })
})
