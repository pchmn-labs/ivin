import { expect, test } from "vitest"
import { decideTrust, permissionList } from "./project-plugin-trust.ts"

const trusted = { hash: "h1", permissions: ["exec: git"] }
const input = { trusted, hash: "h1", permissions: ["exec: git"], fullTrust: false }

test("a version never trusted is new, whatever the hash", () => {
  expect(decideTrust({ ...input, trusted: null, permissions: [] })).toEqual({
    state: "new",
    permissionsChanged: false,
    adopt: false,
  })
})

test("the files that were trusted are trusted", () => {
  expect(decideTrust(input)).toEqual({ state: "trusted", permissionsChanged: false, adopt: false })
})

test("an edit is changed until the project has full trust, which adopts it", () => {
  expect(decideTrust({ ...input, hash: "h2" }).state).toBe("changed")
  expect(decideTrust({ ...input, hash: "h2", fullTrust: true })).toEqual({
    state: "trusted",
    permissionsChanged: false,
    adopt: true,
  })
})

test("full trust adopts a plugin never trusted", () => {
  expect(decideTrust({ ...input, trusted: null, permissions: [], fullTrust: true }).adopt).toBe(
    true,
  )
})

test("new permissions are asked even with full trust, for an edit and for a plugin never trusted", () => {
  const edited = decideTrust({
    ...input,
    hash: "h2",
    permissions: ["exec: git", "fetch: a.com"],
    fullTrust: true,
  })
  const added = decideTrust({
    ...input,
    trusted: null,
    permissions: ["exec: git"],
    fullTrust: true,
  })

  expect(edited).toEqual({ state: "changed", permissionsChanged: true, adopt: false })
  expect(added).toEqual({ state: "new", permissionsChanged: true, adopt: false })
})

test("permissions are compared as sorted lists of kind and entry", () => {
  expect(
    permissionList({ harness: ["beforeSpawn"], exec: ["gh", "git"], fetch: ["a.com"] }),
  ).toEqual(["exec: gh", "exec: git", "fetch: a.com", "harness: beforeSpawn"])
})
