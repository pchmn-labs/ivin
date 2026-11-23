import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeTempDir, openServerVersion } from "./launch-app.ts"

test("the window shows the server's answer to server.getVersion", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await app.firstWindow()
    await expect(await openServerVersion(window)).toHaveText("ivin 0.0.0")
  } finally {
    await app.close()
  }
})
