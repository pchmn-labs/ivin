import { HOST_MODULES_GLOBAL, type UserPlugin } from "@ivin/contracts/plugin"
import { Effect, Layer, Stream } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import { layerFsUserPlugins } from "../modules/plugin/adapters/fs-user-plugins.ts"
import { type Client, makeClient, serverLayer } from "./test-server.ts"

export type { Client }

export const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), `ivin-${prefix}-`))

export const withServer = <A, E>(home: string, use: (client: Client) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(serverLayer().pipe(Layer.provide(layerFsUserPlugins(home)))),
      Effect.scoped,
    ),
  )

export const listPlugins = (home: string) =>
  withServer(home, (client) =>
    client["plugin.list"]().pipe(
      Stream.runCollect,
      Effect.map((plugins) => [...plugins]),
    ),
  )
export const readLog = (home: string, id: string) =>
  withServer(home, (client) => client["plugin.readLog"]({ id }))

export const writeFiles = (folder: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) {
    const file = join(folder, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

export const writePlugin = (home: string, folder: string, files: Record<string, string>) =>
  writeFiles(join(home, "plugins", folder), files)

export const packageJson = (ivin: Record<string, unknown>, more: Record<string, unknown> = {}) =>
  JSON.stringify({ name: "p", ...more, ivin })

export const bundlePath = (home: string, plugin: UserPlugin | undefined) => {
  if (plugin?._tag !== "compiled") throw new Error(`not compiled: ${JSON.stringify(plugin)}`)
  return join(home, "cache", "plugins", plugin.bundle)
}

// The window's role: give the bundle the host's modules, then import it.
export const importBundle = async (path: string) => {
  Object.assign(globalThis, {
    [HOST_MODULES_GLOBAL]: {
      react: React,
      "react/jsx-runtime": jsxRuntime,
      "@ivin/plugin-api/ui": { defineUi: (activate: unknown) => activate },
    },
  })
  return (await import(pathToFileURL(path).href)) as Record<string, unknown>
}
