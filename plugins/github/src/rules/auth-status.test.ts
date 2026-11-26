import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { isNotLoggedIn, parseAuthStatus } from "./auth-status.ts"

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

test("a recorded gh 2.98 status lists each account once, with the active one", () => {
  expect(parseAuthStatus(fixture("auth-status.stdout.txt"))).toEqual([
    { host: "github.com", login: "pchmn", active: true },
    { host: "github.com", login: "paulchemin-silbo", active: false },
  ])
})

test("an older gh prints the same lines on stderr, with several hosts", () => {
  const stderr = [
    "github.com",
    "  ✓ Logged in to github.com account ada (keyring)",
    "  - Active account: true",
    "",
    "ghe.example.com",
    "  ✓ Logged in to ghe.example.com account ada-work (keyring)",
    "  - Active account: true",
    "  ✓ Logged in to ghe.example.com account bob (keyring)",
    "  - Active account: false",
  ].join("\n")
  expect(parseAuthStatus(`\n${stderr}`)).toEqual([
    { host: "github.com", login: "ada", active: true },
    { host: "ghe.example.com", login: "ada-work", active: true },
    { host: "ghe.example.com", login: "bob", active: false },
  ])
})

test("a failed login is not an account, and no login is recognised", () => {
  const output =
    "github.com\n  X Failed to log in to github.com account old (keyring)\n  - Active account: true\n"
  expect(parseAuthStatus(output)).toEqual([])
  expect(
    isNotLoggedIn("You are not logged into any GitHub hosts. To log in, run: gh auth login"),
  ).toBe(true)
  expect(isNotLoggedIn("gh: command exploded")).toBe(false)
})
