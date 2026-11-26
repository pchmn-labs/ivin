import { _electron as electron, expect, test } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir, packagedLaunch } from "./launch-app.ts"
import { startSession } from "./session-helpers.ts"

test("launched with --safe, the app loads no user plugin and says it is in safe mode", async () => {
  const userDataDir = makeTempDir("user-data")
  const folder = join(userDataDir, ".ivin/plugins/hello")
  mkdirSync(join(folder, "src"), { recursive: true })
  writeFileSync(
    join(folder, "package.json"),
    JSON.stringify({ name: "hello", ivin: { id: "hello", ui: "src/ui.tsx" } }),
  )
  writeFileSync(
    join(folder, "src/ui.tsx"),
    `import { defineUi } from "@ivin/plugin-api/ui"
export const activate = defineUi((ctx) => ctx.slots.add("sidebar.bottom", () => <span>hello from a plugin</span>))
`,
  )

  const launch = packagedLaunch(userDataDir)
  const app = await electron.launch({ ...launch, args: [...launch.args, "--safe"] })
  try {
    const window = await startSession(app)
    await expect(window.getByText(/safe mode/i).first()).toBeVisible()
    await expect(window.getByText("hello from a plugin")).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test("a launch after one that quit cleanly is not in safe mode", async () => {
  const userDataDir = makeTempDir("user-data")
  const first = await launchPackagedApp(userDataDir)
  await startSession(first)
  await first.close()

  const second = await launchPackagedApp(userDataDir)
  try {
    const window = await startSession(second)
    await expect(window.getByText(/safe mode/i)).toHaveCount(0)
  } finally {
    await second.close()
  }
})
