import { expect, test } from "vitest"
import { accountOptions, readAccounts, readLogin } from "./command-results.ts"

test("the accounts command's answer is an account list or an error", () => {
  expect(readAccounts({ error: "gh is not installed" })).toEqual({ error: "gh is not installed" })
  expect(
    readAccounts({ accounts: [{ host: "github.com", login: "a", active: true }, { nope: 1 }] }),
  ).toEqual({
    accounts: [{ host: "github.com", login: "a", active: true }],
  })
  expect(readAccounts(null)).toHaveProperty("error")
})

test("a login is read from the project's answer, anything else is no account", () => {
  expect(readLogin({ login: "a" })).toBe("a")
  expect(readLogin({ login: null })).toBeNull()
  expect(readLogin(undefined)).toBeNull()
})

test("the options start with gh's active account, leave out accounts of other hosts, and keep a chosen account gh no longer lists", () => {
  const accounts = [
    { host: "github.com", login: "ada", active: true },
    { host: "ghe.example.com", login: "ada-work", active: false },
  ]
  expect(accountOptions(accounts, null)).toEqual([
    { value: "", label: "gh's active account" },
    { value: "ada", label: "ada" },
  ])
  expect(accountOptions(accounts, "gone")[1]).toEqual({ value: "gone", label: "gone" })
  expect(accountOptions(accounts, "ada")).toHaveLength(2)
})
