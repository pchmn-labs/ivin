import { describe, expect, test } from "vitest"
import { NO_PERMISSIONS, permits, readPermissions } from "./permissions.ts"
import type { Permissions } from "./permissions.ts"

const declared = (permissions: Partial<Permissions>): Permissions => ({
  ...NO_PERMISSIONS,
  ...permissions,
})

describe("readPermissions", () => {
  test("a manifest without permissions declares none", () => {
    expect(readPermissions(undefined)).toEqual({ kind: "valid", permissions: NO_PERMISSIONS })
  })

  test("reads the three lists", () => {
    const value = { harness: ["beforeSpawn"], exec: ["gh", "git"], fetch: ["api.github.com"] }
    expect(readPermissions(value)).toEqual({ kind: "valid", permissions: value })
  })

  test("a list left out is empty", () => {
    expect(readPermissions({ exec: ["gh"] })).toEqual({
      kind: "valid",
      permissions: declared({ exec: ["gh"] }),
    })
  })

  test("exec and fetch accept *", () => {
    expect(readPermissions({ exec: ["*"], fetch: ["*"] }).kind).toBe("valid")
  })

  test.each([
    ["not an object", [], "ivin.permissions"],
    ["an unknown key", { fs: ["*"] }, "ivin.permissions.fs"],
    ["a list that is not an array", { exec: "gh" }, "ivin.permissions.exec"],
    ["a non-string entry", { exec: [3] }, "ivin.permissions.exec"],
    ["an empty entry", { exec: [""] }, "ivin.permissions.exec"],
    ["harness *", { harness: ["*"] }, "ivin.permissions.harness"],
    ["an unknown hook", { harness: ["afterSpawn"] }, "ivin.permissions.harness"],
    ["a URL as a host", { fetch: ["https://api.github.com"] }, "ivin.permissions.fetch"],
    ["a host with a path", { fetch: ["api.github.com/v3"] }, "ivin.permissions.fetch"],
    ["a wildcard in the middle", { fetch: ["api.*.com"] }, "ivin.permissions.fetch"],
    ["a bare *.", { fetch: ["*."] }, "ivin.permissions.fetch"],
  ])("%s is invalid", (_name, value, reason) => {
    const reading = readPermissions(value)
    expect(reading.kind).toBe("invalid")
    expect(reading.kind === "invalid" && reading.reason).toContain(reason)
  })
})

describe("permits harness.beforeSpawn", () => {
  const call = { member: "harness.beforeSpawn" } as const

  test("only when declared", () => {
    expect(permits(declared({ harness: ["beforeSpawn"] }), call)).toEqual({ allowed: true })
    expect(permits(NO_PERMISSIONS, call)).toEqual({
      allowed: false,
      missing: "harness: beforeSpawn",
    })
  })
})

describe("permits exec", () => {
  const exec = (binary: string) => ({ member: "exec", binary }) as const

  test("only a declared binary", () => {
    const permissions = declared({ exec: ["gh", "git"] })
    expect(permits(permissions, exec("gh"))).toEqual({ allowed: true })
    expect(permits(permissions, exec("rm"))).toEqual({ allowed: false, missing: "exec: rm" })
    expect(permits(NO_PERMISSIONS, exec("gh")).allowed).toBe(false)
  })

  test("a path is refused unless that exact path is declared", () => {
    const permissions = declared({ exec: ["gh", "/usr/bin/git"] })
    expect(permits(permissions, exec("./gh")).allowed).toBe(false)
    expect(permits(permissions, exec("/tmp/gh")).allowed).toBe(false)
    expect(permits(permissions, exec("/usr/bin/git")).allowed).toBe(true)
  })

  test("* allows any binary", () => {
    const permissions = declared({ exec: ["*"] })
    expect(permits(permissions, exec("anything")).allowed).toBe(true)
    expect(permits(permissions, exec("/tmp/x")).allowed).toBe(true)
  })
})

describe("permits fetch", () => {
  const fetch = (url: string) => ({ member: "fetch", url }) as const

  test("only a declared host, whatever the path and the port", () => {
    const permissions = declared({ fetch: ["api.github.com"] })
    expect(permits(permissions, fetch("https://api.github.com/repos?x=1")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://API.GITHUB.COM:8443/")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://github.com/")).allowed).toBe(false)
    expect(permits(NO_PERMISSIONS, fetch("https://api.github.com/"))).toEqual({
      allowed: false,
      missing: "fetch: api.github.com",
    })
  })

  test("*.github.com allows subdomains, and refuses look-alikes and the bare domain", () => {
    const permissions = declared({ fetch: ["*.github.com"] })
    expect(permits(permissions, fetch("https://api.github.com/")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://a.b.github.com/")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://github.com.evil.test/")).allowed).toBe(false)
    expect(permits(permissions, fetch("https://evilgithub.com/")).allowed).toBe(false)
    expect(permits(permissions, fetch("https://github.com/")).allowed).toBe(false)
  })

  test("a host hidden in the userinfo is not the host", () => {
    const permissions = declared({ fetch: ["api.github.com"] })
    expect(permits(permissions, fetch("https://api.github.com@evil.test/")).allowed).toBe(false)
  })

  test("* allows any http or https host", () => {
    const permissions = declared({ fetch: ["*"] })
    expect(permits(permissions, fetch("http://localhost:3000/")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://evil.test/")).allowed).toBe(true)
  })

  test.each(["file:///etc/passwd", "ftp://api.github.com/", "not a url", "data:text/plain,x"])(
    "%s is refused even with *",
    (url) => {
      expect(permits(declared({ fetch: ["*"] }), fetch(url)).allowed).toBe(false)
    },
  )

  test("a redirect target is checked like any other URL", () => {
    const permissions = declared({ fetch: ["api.github.com"] })
    expect(permits(permissions, fetch("https://api.github.com/a")).allowed).toBe(true)
    expect(permits(permissions, fetch("https://evil.test/landing")).allowed).toBe(false)
  })
})
