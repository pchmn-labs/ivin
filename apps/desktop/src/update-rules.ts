export interface Manifest {
  readonly version: string
  readonly file: string
  readonly size: number
  readonly sha512: string
}

export interface Release {
  readonly version: string
  readonly notes: string
  readonly url: string
  readonly assets: ReadonlyArray<{ readonly name: string; readonly url: string }>
}

export type UpdateDecision =
  | { readonly kind: "none" }
  | {
      readonly kind: "download"
      readonly version: string
      readonly zipUrl: string
      readonly manifest: Manifest
    }

export const MANIFEST_NAME = "manifest.json"

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const compareNumbers = (a: number, b: number): -1 | 0 | 1 => (a === b ? 0 : a > b ? 1 : -1)

const compareIdentifiers = (x: string, y: string): -1 | 0 | 1 => {
  const xNumber = /^\d+$/.test(x)
  const yNumber = /^\d+$/.test(y)
  if (xNumber && yNumber) return compareNumbers(Number(x), Number(y))
  if (xNumber !== yNumber) return xNumber ? -1 : 1
  return x === y ? 0 : x > y ? 1 : -1
}

// Semver order: a beta comes before its version, and numbered parts compare as numbers.
const comparePrerelease = (a: string | undefined, b: string | undefined): -1 | 0 | 1 => {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1
  const left = a.split(".")
  const right = b.split(".")
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const x = left[index]
    const y = right[index]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    const order = compareIdentifiers(x, y)
    if (order !== 0) return order
  }
  return 0
}

export const compareVersions = (a: string, b: string): -1 | 0 | 1 | null => {
  const left = VERSION.exec(a)
  const right = VERSION.exec(b)
  if (!left || !right) return null
  for (const index of [1, 2, 3]) {
    const order = compareNumbers(Number(left[index]), Number(right[index]))
    if (order !== 0) return order
  }
  return comparePrerelease(left[4], right[4])
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const readRelease = (json: unknown): Release | null => {
  if (!isRecord(json)) return null
  const { tag_name, body, html_url, assets } = json
  if (typeof tag_name !== "string" || typeof html_url !== "string" || !Array.isArray(assets)) {
    return null
  }
  return {
    version: tag_name.replace(/^v/, ""),
    notes: typeof body === "string" ? body : "",
    url: html_url,
    assets: assets.flatMap((asset: unknown) =>
      isRecord(asset) &&
      typeof asset["name"] === "string" &&
      typeof asset["browser_download_url"] === "string"
        ? [{ name: asset["name"], url: asset["browser_download_url"] }]
        : [],
    ),
  }
}

export const newestRelease = (json: unknown): Release | null => {
  if (!Array.isArray(json)) return null
  let newest: Release | null = null
  for (const entry of json) {
    if (isRecord(entry) && entry["draft"] === true) continue
    const release = readRelease(entry)
    if (release === null || compareVersions(release.version, "0.0.0") === null) continue
    if (!release.assets.some((asset) => asset.name === MANIFEST_NAME)) continue
    if (newest === null || compareVersions(release.version, newest.version) === 1) newest = release
  }
  return newest
}

export const readManifest = (json: unknown): Manifest | null => {
  if (!isRecord(json)) return null
  const { version, file, size, sha512 } = json
  if (
    typeof version !== "string" ||
    typeof file !== "string" ||
    !/^[\w.-]+\.zip$/.test(file) ||
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size <= 0 ||
    typeof sha512 !== "string" ||
    !/^[0-9a-f]{128}$/.test(sha512)
  ) {
    return null
  }
  return { version, file, size, sha512 }
}

export const decideUpdate = (
  current: string,
  release: Release,
  manifest: Manifest,
): UpdateDecision => {
  if (manifest.version !== release.version) return { kind: "none" }
  if (compareVersions(release.version, current) !== 1) return { kind: "none" }
  const zip = release.assets.find((asset) => asset.name === manifest.file)
  return zip
    ? { kind: "download", version: release.version, zipUrl: zip.url, manifest }
    : { kind: "none" }
}
