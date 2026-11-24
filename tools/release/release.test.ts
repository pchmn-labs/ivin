import { describe, expect, it } from "vitest"
import { bumpLevel, latestSection, manifest, withVersion } from "./release.ts"

describe("bumpLevel", () => {
  it("is minor for a feat, even a breaking one, while in 0.x", () => {
    expect(bumpLevel(["chore: tidy", "feat(ui): add a card"])).toBe("minor")
    expect(bumpLevel(["feat(server)!: drop a field"])).toBe("minor")
  })

  it("is patch for a fix with no feat", () => {
    expect(bumpLevel(["docs: fix a typo", "fix(ui): stop a flicker (#9)"])).toBe("patch")
  })

  it("is none when no commit is a feat or a fix", () => {
    expect(bumpLevel(["chore(deps): bump x", "docs: y", "refactor(server): z", "feature: not a type"])).toBe("none")
    expect(bumpLevel([])).toBe("none")
  })
})

describe("withVersion", () => {
  it("replaces the version and keeps the rest of the file", () => {
    const text = '{\n  "name": "a",\n  "version": "0.0.0",\n  "private": true\n}\n'
    expect(withVersion(text, "0.1.0")).toBe('{\n  "name": "a",\n  "version": "0.1.0",\n  "private": true\n}\n')
  })

  it("leaves a file with no version alone", () => {
    expect(withVersion('{"name":"a"}', "0.1.0")).toBe('{"name":"a"}')
  })
})

describe("manifest", () => {
  it("gives the version, file name, size and SHA-512 of the zip", () => {
    const bytes = new TextEncoder().encode("abc")
    expect(JSON.parse(manifest("0.1.0", "ivin-0.1.0-arm64.zip", bytes))).toEqual({
      version: "0.1.0",
      file: "ivin-0.1.0-arm64.zip",
      size: 3,
      sha512:
        "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    })
  })
})

describe("latestSection", () => {
  it("takes the top version's notes without its heading", () => {
    const changelog = "# Changelog\n\n## [0.2.0](url) (2026-01-02)\n\n### Features\n\n* a\n\n## 0.1.0 (2026-01-01)\n\n* b\n"
    expect(latestSection(changelog)).toBe("### Features\n\n* a\n")
  })
})
