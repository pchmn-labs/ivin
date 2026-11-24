import { spawn, type ChildProcess } from "node:child_process"
import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { access, constants, mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"
import { pipeline } from "node:stream/promises"
import type { UpdateFailure, UpdateState } from "@ivin/contracts/update"
import {
  decideUpdate,
  MANIFEST_NAME,
  newestRelease,
  readManifest,
  readRelease,
  type Manifest,
} from "./update-rules.ts"
import { extractZip } from "./extract-zip.ts"

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000

export interface UpdaterDeps {
  // GitHub's releases endpoint of the repo, without a trailing slash.
  readonly releasesUrl: string
  readonly current: string
  readonly bundle: string
  readonly folder: string
  readonly autoCheck: () => boolean
  readonly beta: () => boolean
  readonly onState: (state: UpdateState) => void
}

class UpdateError extends Error {
  constructor(readonly reason: UpdateFailure) {
    super(reason)
  }
}

const fetchJson = async (
  url: string,
  options: { readonly missingIsNull?: boolean } = {},
): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 404 && options.missingIsNull) return null
  if (!response.ok) throw new UpdateError("network")
  return response.json()
}

const download = async (
  url: string,
  file: string,
  manifest: Manifest,
  onPercent: (percent: number) => void,
): Promise<void> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok || !response.body) throw new UpdateError("network")
  const hash = createHash("sha512")
  let received = 0
  const body = Readable.fromWeb(response.body as unknown as NodeReadableStream)
  body.on("data", (chunk: Buffer) => {
    hash.update(chunk)
    received += chunk.length
    onPercent(Math.min(100, Math.floor((received / manifest.size) * 100)))
  })
  await pipeline(body, createWriteStream(file))
  if (received !== manifest.size || hash.digest("hex") !== manifest.sha512) {
    throw new UpdateError("fingerprint")
  }
}

export const createUpdater = (deps: UpdaterDeps) => {
  let state: UpdateState = { kind: "idle", current: deps.current }
  let staged: { readonly bundle: string; readonly version: string } | null = null
  const set = (next: UpdateState) => {
    state = next
    deps.onState(next)
  }

  const run = async () => {
    const release = deps.beta()
      ? newestRelease(await fetchJson(deps.releasesUrl))
      : // GitHub answers 404 here while the repo has no stable release.
        readRelease(await fetchJson(`${deps.releasesUrl}/latest`, { missingIsNull: true }))
    const manifestAsset = release?.assets.find((asset) => asset.name === MANIFEST_NAME)
    if (!release || !manifestAsset) return set({ kind: "idle", current: deps.current })
    const manifest = readManifest(await fetchJson(manifestAsset.url))
    const decision = manifest ? decideUpdate(deps.current, release, manifest) : null
    if (!decision || decision.kind === "none") return set({ kind: "idle", current: deps.current })

    // The folder is checked before the download, so a read-only install never waits for one.
    await access(dirname(deps.bundle), constants.W_OK).catch(() => {
      throw new UpdateError("notWritable")
    })
    const { version } = decision
    const base = { current: deps.current, version, notes: release.notes, url: release.url }
    const folder = join(deps.folder, version)
    await rm(deps.folder, { recursive: true, force: true })
    await mkdir(folder, { recursive: true })
    const zip = join(folder, decision.manifest.file)
    set({ kind: "downloading", ...base, percent: 0 })
    let shown = 0
    try {
      await download(decision.zipUrl, zip, decision.manifest, (percent) => {
        if (percent === shown) return
        shown = percent
        set({ kind: "downloading", ...base, percent })
      })
      const extracted = join(folder, "extracted")
      await extractZip(zip, extracted)
      await rm(zip, { force: true })
      const unpacked = join(extracted, "ivin.app")
      await access(unpacked).catch(() => {
        throw new UpdateError("fingerprint")
      })
      staged = { bundle: unpacked, version }
    } catch (error) {
      await rm(deps.folder, { recursive: true, force: true })
      throw error
    }
    set({ kind: "ready", ...base })
  }

  let inFlight: Promise<void> | null = null
  const check = (options: { readonly manual: boolean }): Promise<void> => {
    if (state.kind === "ready") return Promise.resolve()
    if (inFlight) return inFlight
    if (!options.manual && !deps.autoCheck()) return Promise.resolve()
    inFlight = attempt(options.manual).finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const attempt = async (manual: boolean): Promise<void> => {
    if (manual) set({ kind: "checking", current: deps.current })
    try {
      await run()
    } catch (error) {
      if (!(error instanceof UpdateError)) console.error("update check failed", error)
      set({
        kind: "failed",
        current: deps.current,
        reason: error instanceof UpdateError ? error.reason : "network",
      })
    }
  }

  const start = (): (() => void) => {
    void check({ manual: false })
    const timer = setInterval(() => void check({ manual: false }), CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }

  return { check, start, state: () => state, staged: () => staged }
}

// Run after the app has quit: the bundle cannot be replaced while it runs.
const SWAP = `
pid=$1 target=$2 staged=$3 relaunch=$4
shift 4
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
old="$target.old"
rm -rf "$old"
if mv "$target" "$old"; then
  if mv "$staged" "$target"; then rm -rf "$old"; else mv "$old" "$target"; fi
fi
if [ "$relaunch" = 1 ]; then exec "$target/Contents/MacOS/ivin" "$@"; fi
`

export const startSwap = (options: {
  readonly pid: number
  readonly target: string
  readonly staged: string
  readonly relaunch: boolean
  // What the relaunched app is started with, so it keeps the same data folder.
  readonly args?: ReadonlyArray<string>
}): ChildProcess => {
  const child = spawn(
    "/bin/sh",
    [
      "-c",
      SWAP,
      "ivin-update",
      String(options.pid),
      options.target,
      options.staged,
      options.relaunch ? "1" : "0",
      ...(options.args ?? []),
    ],
    { detached: true, stdio: "ignore" },
  )
  child.unref()
  return child
}
