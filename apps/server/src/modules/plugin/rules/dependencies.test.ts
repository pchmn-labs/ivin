import { expect, test } from "vitest"
import {
  dependenciesOf,
  installManifest,
  pnpmError,
  relativeLocalDependency,
} from "./dependencies.ts"

test("a package.json's dependencies are its string entries, and none when it is not JSON", () => {
  expect(dependenciesOf(JSON.stringify({ dependencies: { a: "1.0.0", b: 2 } }))).toEqual({
    a: "1.0.0",
  })
  expect(dependenciesOf(JSON.stringify({ peerDependencies: { a: "1" } }))).toEqual({})
  expect(dependenciesOf("{")).toEqual({})
})

test("the install manifest holds only the dependencies", () => {
  expect(installManifest({ a: "1.0.0" })).toBe('{"dependencies":{"a":"1.0.0"}}\n')
})

test("a file: or link: dependency with a relative path is named; an absolute one is not", () => {
  expect(relativeLocalDependency({ a: "1.0.0", b: "file:../b" })).toBe("b")
  expect(relativeLocalDependency({ c: "link:./c" })).toBe("c")
  expect(relativeLocalDependency({ a: "file:/abs/a", b: "^2" })).toBeNull()
})

test("pnpm's error is its ERR_PNPM line, or its last line", () => {
  expect(
    pnpmError("Progress\n ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with frozen-lockfile\nmore"),
  ).toEqual({ code: "ERR_PNPM_OUTDATED_LOCKFILE", message: "Cannot install with frozen-lockfile" })
  expect(pnpmError("something\nbroke\n\n")).toEqual({ code: null, message: "broke" })
})
