import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { UpdateState } from "@ivin/contracts/update"
import { createUpdater, startSwap } from "./updater.ts"

const temp = () => mkdtempSync(join(tmpdir(), "ivin-updater-"))

const makeBundle = (parent: string, marker: string) => {
  const bundle = join(parent, "ivin.app")
  mkdirSync(join(bundle, "Contents/Resources"), { recursive: true })
  writeFileSync(join(bundle, "Contents/Resources/marker"), marker)
  return bundle
}

const zipOf = (marker: string) => {
  const folder = temp()
  makeBundle(folder, marker)
  execFileSync("zip", ["-qry", "ivin-0.4.0-arm64.zip", "ivin.app"], { cwd: folder })
  return readFileSync(join(folder, "ivin-0.4.0-arm64.zip"))
}

interface Fake {
  version: string
  zip: Buffer
  manifestSha: string
  requests: string[]
}

let server: Server
let fake: Fake
let base: string

beforeEach(async () => {
  const zip = zipOf("new")
  fake = {
    version: "0.4.0",
    zip,
    manifestSha: createHash("sha512").update(zip).digest("hex"),
    requests: [],
  }
  server = createServer((request, response) => {
    fake.requests.push(request.url ?? "")
    if (request.url === "/release") {
      response.setHeader("content-type", "application/json")
      response.end(
        JSON.stringify({
          tag_name: `v${fake.version}`,
          body: "- a fix",
          html_url: "https://example.test/release",
          assets: [
            { name: "manifest.json", browser_download_url: `${base}/manifest.json` },
            { name: "ivin-0.4.0-arm64.zip", browser_download_url: `${base}/ivin-0.4.0-arm64.zip` },
          ],
        }),
      )
    } else if (request.url === "/manifest.json") {
      response.end(
        JSON.stringify({
          version: fake.version,
          file: "ivin-0.4.0-arm64.zip",
          size: fake.zip.length,
          sha512: fake.manifestSha,
        }),
      )
    } else if (request.url === "/ivin-0.4.0-arm64.zip") {
      response.end(fake.zip)
    } else {
      response.statusCode = 404
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

const setup = (options: { autoCheck?: boolean; releaseUrl?: string; chmod?: number } = {}) => {
  const home = temp()
  const installed = join(home, "Applications")
  mkdirSync(installed)
  const bundle = makeBundle(installed, "old")
  if (options.chmod !== undefined) chmodSync(installed, options.chmod)
  const states: UpdateState[] = []
  const updater = createUpdater({
    releaseUrl: options.releaseUrl ?? `${base}/release`,
    current: "0.3.2",
    bundle,
    folder: join(home, "updates"),
    autoCheck: () => options.autoCheck ?? true,
    onState: (state) => states.push(state),
  })
  return { updater, states, bundle, installed, folder: join(home, "updates") }
}

const swap = (bundle: string, staged: string) =>
  new Promise<number | null>((resolve) => {
    const dead = execFileSync("sh", ["-c", "echo $$"]).toString().trim()
    startSwap({ pid: Number(dead), target: bundle, staged, relaunch: false }).once("exit", resolve)
  })

test("a good zip is downloaded, checked and put in the app's place", async () => {
  const { updater, states, bundle } = setup()

  await updater.check({ manual: false })

  expect(states.at(-1)).toMatchObject({ kind: "ready", version: "0.4.0", notes: "- a fix" })
  const staged = updater.staged()
  expect(staged?.version).toBe("0.4.0")
  expect(readFileSync(join(bundle, "Contents/Resources/marker"), "utf8")).toBe("old")

  expect(await swap(bundle, staged!.bundle)).toBe(0)

  expect(readFileSync(join(bundle, "Contents/Resources/marker"), "utf8")).toBe("new")
  expect(existsSync(`${bundle}.old`)).toBe(false)
})

test("a zip whose SHA-512 differs from the manifest's is refused and deleted", async () => {
  const { updater, states, folder } = setup()
  fake.manifestSha = "0".repeat(128)

  await updater.check({ manual: false })

  expect(states.at(-1)).toMatchObject({ kind: "failed", reason: "fingerprint" })
  expect(updater.staged()).toBeNull()
  expect(existsSync(join(folder, "0.4.0"))).toBe(false)
})

test.skipIf(process.getuid?.() === 0)(
  "a folder the app cannot write to keeps the current app and downloads nothing",
  async () => {
    const { updater, states, bundle, installed } = setup({ chmod: 0o555 })

    await updater.check({ manual: false })
    chmodSync(installed, 0o755)

    expect(states.at(-1)).toMatchObject({ kind: "failed", reason: "notWritable" })
    expect(fake.requests).not.toContain("/ivin-0.4.0-arm64.zip")
    expect(readFileSync(join(bundle, "Contents/Resources/marker"), "utf8")).toBe("old")
  },
)

test("a release server that cannot be reached fails as a network problem", async () => {
  const { updater, states } = setup({ releaseUrl: "http://127.0.0.1:1/release" })

  await updater.check({ manual: false })

  expect(states.at(-1)).toMatchObject({ kind: "failed", reason: "network" })
})

test("a failed check is tried again by the next one", async () => {
  const { updater, states } = setup()
  fake.manifestSha = "0".repeat(128)
  await updater.check({ manual: false })
  fake.manifestSha = createHash("sha512").update(fake.zip).digest("hex")

  await updater.check({ manual: true })

  expect(states.at(-1)?.kind).toBe("ready")
})

test("a manual check that finds nothing newer says the app is current", async () => {
  const { updater, states } = setup()
  fake.version = "0.3.2"

  await updater.check({ manual: true })

  expect(states.map((state) => state.kind)).toEqual(["checking", "idle"])
})

test("with the automatic check off, no request leaves until a check is run by hand", async () => {
  const { updater } = setup({ autoCheck: false })

  const stop = updater.start()
  await updater.check({ manual: false })
  stop()
  expect(fake.requests).toEqual([])

  await updater.check({ manual: true })
  expect(fake.requests).toContain("/release")
})

test("the relaunch starts the new app with the arguments the old one had", async () => {
  const { bundle, installed } = setup()
  const staged = makeBundle(temp(), "new")
  const launched = join(installed, "launched")
  mkdirSync(join(staged, "Contents/MacOS"), { recursive: true })
  const executable = join(staged, "Contents/MacOS/ivin")
  writeFileSync(executable, `#!/bin/sh\necho "$@" > "${launched}"\n`)
  chmodSync(executable, 0o755)
  const dead = execFileSync("sh", ["-c", "echo $$"]).toString().trim()

  startSwap({
    pid: Number(dead),
    target: bundle,
    staged,
    relaunch: true,
    args: ["--user-data-dir=/data"],
  })

  await vi.waitFor(() => expect(readFileSync(launched, "utf8")).toBe("--user-data-dir=/data\n"))
})
