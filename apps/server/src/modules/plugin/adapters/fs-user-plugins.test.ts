import { Effect } from "effect"
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { UserPlugins, type UserPluginsService } from "../usecases/user-plugins.ts"
import { layerFsUserPlugins } from "./fs-user-plugins.ts"

const setup = () => {
  const home = mkdtempSync(join(tmpdir(), "ivin-home-"))
  const folder = mkdtempSync(join(tmpdir(), "ivin-plugin-"))
  mkdirSync(join(folder, "src"))
  writeFileSync(join(folder, "package.json"), "{}")
  writeFileSync(join(folder, "src", "ui.ts"), "export const x = 1\n")
  const run = <A>(use: (plugins: UserPluginsService) => Effect.Effect<A>) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* use((yield* UserPlugins)!)
      }).pipe(Effect.provide(layerFsUserPlugins(home))),
    )
  return { home, folder, run }
}

test("a copy kept under a hash holds the files that hash covers", async () => {
  const { folder, run } = setup()

  const result = await run((plugins) =>
    Effect.gen(function* () {
      const tree = (yield* plugins.readTree(folder))!
      const kept = yield* plugins.keepTrusted(tree.hash, folder)
      return { hash: tree.hash, kept, copy: kept === null ? null : yield* plugins.readTree(kept) }
    }),
  )

  expect(result.copy?.hash).toBe(result.hash)
})

test("files that differ from the hash the user saw are not kept, and nothing is left behind", async () => {
  const { home, folder, run } = setup()

  const kept = await run((plugins) =>
    Effect.gen(function* () {
      const tree = (yield* plugins.readTree(folder))!
      writeFileSync(join(folder, "src", "ui.ts"), "export const x = 2\n")
      return yield* plugins.keepTrusted(tree.hash, folder)
    }),
  )

  expect(kept).toBeNull()
  expect(readdirSync(join(home, "cache", "plugin-trust"))).toEqual([])
})

test("a kept copy that does not hash to its name is missing, and keeping it again replaces it", async () => {
  const { folder, run } = setup()

  const result = await run((plugins) =>
    Effect.gen(function* () {
      const tree = (yield* plugins.readTree(folder))!
      const kept = (yield* plugins.keepTrusted(tree.hash, folder))!
      writeFileSync(join(kept, "src", "ui.ts"), "tampered\n")
      const tampered = yield* plugins.trustedFolder(tree.hash)
      const renewed = yield* plugins.keepTrusted(tree.hash, folder)
      return { tampered, renewed, again: yield* plugins.trustedFolder(tree.hash), kept }
    }),
  )

  expect(result.tampered).toBeNull()
  expect(result.renewed).toBe(result.kept)
  expect(result.again).toBe(result.kept)
})
