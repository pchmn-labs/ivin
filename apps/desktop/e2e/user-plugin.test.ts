import { expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { startSession } from "./session-helpers.ts"

const writePlugin = (userDataDir: string, folder: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) {
    const file = join(userDataDir, ".ivin/plugins", folder, path)
    mkdirSync(join(file, ".."), { recursive: true })
    writeFileSync(file, text)
  }
}

test("a plugin in ~/.ivin/plugins is compiled and shows in the window, beside one that fails", async () => {
  const userDataDir = makeTempDir("user-data")
  writePlugin(userDataDir, "hello", {
    "package.json": JSON.stringify({ name: "hello", ivin: { id: "hello", ui: "src/ui.tsx" } }),
    "src/ui.tsx": `import { useState } from "react"
import { defineUi } from "@ivin/plugin-api/ui"

function Hello() {
  const [count] = useState(41)
  return <span>hello from a plugin {count + 1}</span>
}

export const activate = defineUi((ctx) => ctx.slots.add("sidebar.bottom", Hello))
`,
  })
  writePlugin(userDataDir, "broken", {
    "package.json": JSON.stringify({ ivin: { id: "broken", ui: "src/ui.tsx" } }),
    "src/ui.tsx": "export const activate = (",
  })

  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await startSession(app)
    await expect(window.getByText("hello from a plugin 42")).toBeVisible()
  } finally {
    await app.close()
  }
})
