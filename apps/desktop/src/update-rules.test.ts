import { expect, test } from "vitest"
import {
  compareVersions,
  decideUpdate,
  readManifest,
  readRelease,
  type Manifest,
  type Release,
} from "./update-rules.ts"

const sha512 = "a".repeat(128)
const manifest: Manifest = { version: "0.4.0", file: "ivin-0.4.0-arm64.zip", size: 10, sha512 }
const release: Release = {
  version: "0.4.0",
  notes: "- a fix",
  url: "https://github.com/pchmn-labs/ivin/releases/tag/v0.4.0",
  assets: [
    { name: "ivin-0.4.0-arm64.zip", url: "https://example.test/zip" },
    { name: "manifest.json", url: "https://example.test/manifest" },
  ],
}

test("versions compare number by number, not as text", () => {
  expect(compareVersions("0.10.0", "0.9.0")).toBe(1)
  expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
  expect(compareVersions("0.3.2", "0.4.0")).toBe(-1)
  expect(compareVersions("v0.4.0", "0.4.0")).toBe(0)
})

test("a version that is not three numbers compares as unknown", () => {
  expect(compareVersions("0.4", "0.4.0")).toBeNull()
  expect(compareVersions("0.4.0-beta.1", "0.3.0")).toBeNull()
  expect(compareVersions("latest", "0.3.0")).toBeNull()
})

test("a GitHub release is read into its version, notes, page and assets", () => {
  expect(
    readRelease({
      tag_name: "v0.4.0",
      body: "- a fix",
      html_url: release.url,
      assets: [
        { name: "ivin-0.4.0-arm64.zip", browser_download_url: "https://example.test/zip" },
        { name: "manifest.json", browser_download_url: "https://example.test/manifest" },
      ],
    }),
  ).toEqual(release)
  expect(readRelease({ tag_name: "v0.4.0" })).toBeNull()
  expect(readRelease(null)).toBeNull()
})

test("a manifest needs a version, a plain file name, a size and a SHA-512", () => {
  expect(readManifest({ version: "0.4.0", file: "a.zip", size: 10, sha512 })).toEqual({
    version: "0.4.0",
    file: "a.zip",
    size: 10,
    sha512,
  })
  expect(readManifest({ version: "0.4.0", file: "../a.zip", size: 10, sha512 })).toBeNull()
  expect(readManifest({ version: "0.4.0", file: "a.zip", size: 10, sha512: "abc" })).toBeNull()
  expect(readManifest({ version: "0.4.0", file: "a.zip", size: 0, sha512 })).toBeNull()
})

test("a newer release whose manifest names an asset it has is downloaded", () => {
  expect(decideUpdate("0.3.2", release, manifest)).toEqual({
    kind: "download",
    version: "0.4.0",
    zipUrl: "https://example.test/zip",
    manifest,
  })
})

test("the same or an older release is left alone", () => {
  expect(decideUpdate("0.4.0", release, manifest)).toEqual({ kind: "none" })
  expect(decideUpdate("0.5.0", release, manifest)).toEqual({ kind: "none" })
})

test("a release whose manifest disagrees with it, or lacks its zip, is left alone", () => {
  expect(decideUpdate("0.3.2", release, { ...manifest, version: "0.4.1" })).toEqual({
    kind: "none",
  })
  expect(decideUpdate("0.3.2", release, { ...manifest, file: "other.zip" })).toEqual({
    kind: "none",
  })
})
