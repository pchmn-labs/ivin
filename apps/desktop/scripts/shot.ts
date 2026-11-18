import { _electron as electron } from "@playwright/test"
import { mkdirSync, rmSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempDir } from "../e2e/launch-app.ts"
import { sendMessage, startSession } from "../e2e/session-helpers.ts"

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(desktopDir, "shots")

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  args: [join(desktopDir, "dist/main.js"), `--user-data-dir=${makeTempDir("user-data")}`],
  env: { ...process.env, IVIN_BACKGROUND: "1", IVIN_HARNESS: "scripted-approval" },
})

const written: string[] = []
try {
  const window = await startSession(app)
  const shoot = async (name: string) => {
    const path = join(outDir, `${String(written.length + 1).padStart(2, "0")}-${name}.png`)
    await window.screenshot({ path })
    written.push(path)
  }

  await shoot("new-session")
  await sendMessage(window, "How many files are there?")
  await window
    .getByTestId("composer-status")
    .getByText(/tokens|\$/)
    .first()
    .waitFor()
  await shoot("answer")
  await sendMessage(window, "Run the tests")
  await window
    .getByTestId("transcript-item")
    .and(window.locator('[data-type="approval"]'))
    .waitFor()
  await shoot("approval")
} finally {
  await app.close()
}

for (const path of written) console.log(relative(process.cwd(), path))
