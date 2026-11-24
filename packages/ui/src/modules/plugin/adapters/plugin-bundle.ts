import { HOST_MODULES_GLOBAL, type HostModule } from "@ivin/contracts/plugin"
import * as pluginApiUi from "@ivin/plugin-api/ui"
import { pluginBundleUrl } from "../rules/plugin-bundle-url.ts"
import * as React from "react"
import * as ReactDom from "react-dom"
import * as jsxRuntime from "react/jsx-runtime"

const hostModules: Record<Exclude<HostModule, "@ivin/plugin-api/editor">, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "react-dom": ReactDom,
  "@ivin/plugin-api/ui": pluginApiUi,
}

export type ImportBundle = (bundle: string) => Promise<Record<string, unknown>>

// CodeMirror stays out of the startup chunk until a plugin bundle or an editor needs it.
export const exposeHostModules = async () => {
  const modules: Record<HostModule, unknown> = {
    ...hostModules,
    "@ivin/plugin-api/editor": await import("@ivin/plugin-api/editor"),
  }
  Object.assign(globalThis, { [HOST_MODULES_GLOBAL]: modules })
}

// Served by the desktop app from ivin's plugin cache.
export const importPluginBundle: ImportBundle = async (bundle) => {
  await exposeHostModules()
  return import(/* @vite-ignore */ pluginBundleUrl(bundle))
}
