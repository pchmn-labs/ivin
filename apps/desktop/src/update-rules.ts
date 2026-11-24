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

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/

export const compareVersions = (a: string, b: string): -1 | 0 | 1 | null => {
  const left = VERSION.exec(a)
  const right = VERSION.exec(b)
  if (!left || !right) return null
  for (const index of [1, 2, 3]) {
    const difference = Number(left[index]) - Number(right[index])
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
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

export const MANIFEST_NAME = "manifest.json"
