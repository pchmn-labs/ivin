import { expect, test } from "vitest"
import { permissionWords } from "./permission-words.ts"

const none = { harness: [], exec: [], fetch: [] }

test("a * comes first and leaves out the names it covers", () => {
  expect(
    permissionWords(
      { harness: ["beforeSpawn"], exec: ["gh", "*"], fetch: ["*.github.com", "*"] },
      true,
    ).declared,
  ).toEqual([
    "Runs any program",
    "Connects to any host",
    "Changes the environment of the agents ivin starts",
  ])
})

test("named programs and hosts are listed one by one, a *.host as its subdomains", () => {
  expect(
    permissionWords({ ...none, exec: ["gh"], fetch: ["api.github.com", "*.example.com"] }, true)
      .declared,
  ).toEqual(["Runs gh", "Connects to api.github.com", "Connects to any host under example.com"])
})

test("a plugin without a server half says it cannot run commands", () => {
  expect(permissionWords(none, false)).toEqual({
    reach: "Cannot run commands or read files",
    declared: [],
  })
  expect(permissionWords(none, true).reach).toBe("Runs code on your machine with your rights")
})
