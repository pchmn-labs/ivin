import { HOST_MODULES_GLOBAL, type HostModule } from "@ivin/contracts/plugin"
import * as pluginApiEditor from "@ivin/plugin-api/editor"
import * as pluginApiUi from "@ivin/plugin-api/ui"
import { pluginBundleUrl } from "../rules/plugin-bundle-url.ts"
import * as React from "react"
import * as ReactDom from "react-dom"
import * as jsxRuntime from "react/jsx-runtime"

const hostModules: Record<HostModule, unknown> = {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "react-dom": ReactDom,
  "@ivin/plugin-api/ui": pluginApiUi,
  "@ivin/plugin-api/editor": pluginApiEditor,
}

export type ImportBundle = (bundle: string) => Promise<Record<string, unknown>>

export const exposeHostModules = () => {
  Object.assign(globalThis, { [HOST_MODULES_GLOBAL]: hostModules })
}

// Served by the desktop app from ivin's plugin cache.
export const importPluginBundle: ImportBundle = (bundle) => {
  exposeHostModules()
  return import(/* @vite-ignore */ pluginBundleUrl(bundle))
}
