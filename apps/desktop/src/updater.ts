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
  readManifest,
  readRelease,
  type Manifest,
} from "./update-rules.ts"
import { extractZip } from "./extract-zip.ts"

export const CHECK_INTERVAL_MS = 60 * 60 * 1000

export interface UpdaterDeps {
  readonly releaseUrl: string
  readonly current: string
  // The running app bundle: the one an update replaces.
  readonly bundle: string
  readonly folder: string
  readonly autoCheck: () => boolean
  readonly onState: (state: UpdateState) => void
}

class UpdateError extends Error {
  constructor(readonly reason: UpdateFailure) {
    super(reason)
  }
}

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { accept: "application/json" } })
  if (!response.ok) throw new UpdateError("network")
  return response.json()
}

const download = async (
  url: string,
  file: string,
  manifest: Manifest,
  onPercent: (percent: number) => void,
): Promise<void> => {
  const response = await fetch(url)
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
    const release = readRelease(await fetchJson(deps.releaseUrl))
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
      staged = { bundle: join(extracted, "ivin.app"), version }
    } catch (error) {
      await rm(deps.folder, { recursive: true, force: true })
      throw error
    }
    set({ kind: "ready", ...base })
  }

  const check = async (options: { readonly manual: boolean }): Promise<void> => {
    if (state.kind === "checking" || state.kind === "downloading" || state.kind === "ready") return
    if (!options.manual && !deps.autoCheck()) return
    if (options.manual) set({ kind: "checking", current: deps.current })
    try {
      await run()
    } catch (error) {
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

export type Updater = ReturnType<typeof createUpdater>

// Run after the app has quit: the bundle cannot be replaced while it runs.
const SWAP = `
pid=$1 target=$2 staged=$3 relaunch=$4
shift 4
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
old="$target.old"
rm -rf "$old"
mv "$target" "$old" || exit 1
if ! mv "$staged" "$target"; then mv "$old" "$target"; exit 1; fi
rm -rf "$old"
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
