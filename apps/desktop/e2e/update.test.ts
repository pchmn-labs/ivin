import { expect, test, _electron as electron } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { makeTempDir, packagedExecutable, packagedLaunch } from "./launch-app.ts"
import { startSession } from "./session-helpers.ts"

test.skip(
  process.platform !== "darwin" || process.arch !== "arm64",
  "an update replaces a macOS arm64 app bundle",
)

const NEW_VERSION = "0.0.1"
const ZIP = `ivin-${NEW_VERSION}-arm64.zip`

interface FakeRelease {
  readonly url: string
  readonly requests: string[]
  readonly close: () => void
}

// The app's own bundle plus a marker file, zipped as the release workflow zips it.
const releaseServer = async (bundle: string): Promise<FakeRelease> => {
  const staging = makeTempDir("release")
  const next = join(staging, "ivin.app")
  execFileSync("ditto", [bundle, next])
  writeFileSync(join(next, "Contents/Resources/update-marker"), NEW_VERSION)
  const zipFile = join(staging, ZIP)
  execFileSync("ditto", ["-c", "-k", "--keepParent", next, zipFile])
  const zip = readFileSync(zipFile)
  const requests: string[] = []
  let base = ""
  const server: Server = createServer((request, response) => {
    requests.push(request.url ?? "")
    if (request.url === "/releases/latest") {
      response.end(
        JSON.stringify({
          tag_name: `v${NEW_VERSION}`,
          body: "- a newer ivin",
          html_url: `${base}/page`,
          assets: [
            { name: "manifest.json", browser_download_url: `${base}/manifest.json` },
            { name: ZIP, browser_download_url: `${base}/${ZIP}` },
          ],
        }),
      )
    } else if (request.url === "/manifest.json") {
      response.end(
        JSON.stringify({
          version: NEW_VERSION,
          file: ZIP,
          size: zip.length,
          sha512: createHash("sha512").update(zip).digest("hex"),
        }),
      )
    } else if (request.url === `/${ZIP}`) {
      response.end(zip)
    } else {
      response.statusCode = 404
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { url: `${base}/releases`, requests, close: () => server.close() }
}

// A copy of the packaged app to replace, so the build stays as it is.
const installedCopy = () => {
  const bundle = join(makeTempDir("installed"), "ivin.app")
  execFileSync("ditto", [join(packagedExecutable, "../../.."), bundle])
  return bundle
}

const launchCopy = (bundle: string, userDataDir: string, releaseUrl: string) => {
  const launch = packagedLaunch(userDataDir)
  return electron.launch({
    ...launch,
    executablePath: join(bundle, "Contents/MacOS/ivin"),
    env: { ...launch.env, IVIN_UPDATE_URL: releaseUrl },
  })
}

test("a newer release is downloaded in the background, and a click replaces the app and relaunches it", async () => {
  const bundle = installedCopy()
  const release = await releaseServer(bundle)
  const app = await launchCopy(bundle, makeTempDir("user-data"), release.url)
  try {
    const window = await startSession(app)
    const restart = window.getByRole("button", { name: "Restart to update" })
    await expect(restart).toBeVisible({ timeout: 30_000 })
    expect(existsSync(join(bundle, "Contents/Resources/update-marker"))).toBe(false)

    const exited = new Promise((resolve) => app.process().once("exit", resolve))
    await restart.click()
    await exited

    await expect
      .poll(() => existsSync(join(bundle, "Contents/Resources/update-marker")), { timeout: 30_000 })
      .toBe(true)
    await expect
      .poll(() => {
        try {
          return execFileSync("pgrep", ["-f", join(bundle, "Contents/MacOS/ivin")]).length > 0
        } catch {
          return false
        }
      })
      .toBe(true)
  } finally {
    release.close()
    try {
      execFileSync("pkill", ["-f", bundle])
    } catch {
      // Nothing was relaunched.
    }
  }
})

test("with the automatic check off, no request leaves the app until Check for updates is run", async () => {
  const bundle = installedCopy()
  const release = await releaseServer(bundle)
  const userDataDir = makeTempDir("user-data")
  mkdirSync(join(userDataDir, ".ivin"))
  writeFileSync(
    join(userDataDir, ".ivin/settings.json"),
    JSON.stringify({ updates: { automaticCheck: false } }),
  )
  const app = await launchCopy(bundle, userDataDir, release.url)
  try {
    const page = await startSession(app)
    await expect(page.getByRole("complementary")).toBeVisible()
    expect(release.requests).toEqual([])

    await page.evaluate(() =>
      (
        window as unknown as { ivin: { checkForUpdates: () => Promise<unknown> } }
      ).ivin.checkForUpdates(),
    )

    await expect(page.getByRole("button", { name: "Restart to update" })).toBeVisible({
      timeout: 30_000,
    })
    expect(release.requests).toContain("/releases/latest")
  } finally {
    release.close()
    await app.close()
  }
})
