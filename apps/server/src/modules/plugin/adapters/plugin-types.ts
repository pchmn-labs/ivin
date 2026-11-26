import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type { TypePaths } from "../rules/plugin-template.ts"

// The desktop app ships these in a folder of its own (`tsdown.config.ts`, `electron-builder.yml`) and names it to the server; without it, a source checkout reads its own packages.
const shippedIn = (toolsFolder: string | undefined) =>
  toolsFolder !== undefined && existsSync(join(toolsFolder, "plugin-types")) ? toolsFolder : null

const packageFolder = (from: string, name: string) => {
  try {
    return dirname(createRequire(join(from, "x.ts")).resolve(`${name}/package.json`))
  } catch {
    return null
  }
}

export const pluginTypePaths = (toolsFolder: string | undefined): TypePaths => {
  const shipped = shippedIn(toolsFolder)
  if (shipped !== null) {
    const types = join(shipped, "plugin-types")
    const modules = join(types, "modules")
    return {
      "@ivin/plugin-api/*": [join(types, "plugin-api", "src", "*.ts")],
      react: [join(modules, "@types", "react")],
      "react/jsx-runtime": [join(modules, "@types", "react", "jsx-runtime")],
      "react-dom": [join(modules, "@types", "react-dom")],
      // What the plugin API's sources import, from the shipped copies.
      "*": [join(modules, "*"), join(modules, "@types", "*")],
    }
  }
  const api = dirname(createRequire(import.meta.url).resolve("@ivin/plugin-api/server"))
  const paths: Record<string, string[]> = { "@ivin/plugin-api/*": [join(api, "*.ts")] }
  const react = packageFolder(api, "@types/react")
  if (react !== null) {
    paths["react"] = [react]
    paths["react/jsx-runtime"] = [join(react, "jsx-runtime")]
  }
  const reactDom = packageFolder(api, "@types/react-dom")
  if (reactDom !== null) paths["react-dom"] = [reactDom]
  return paths
}

export const typescriptFile = (toolsFolder: string | undefined) => {
  const shipped = shippedIn(toolsFolder)
  return shipped === null
    ? createRequire(import.meta.url).resolve("typescript-compiler-api")
    : join(shipped, "typescript", "typescript.cjs")
}

export const checkWorkerFile = (toolsFolder: string | undefined) => {
  const shipped = shippedIn(toolsFolder)
  return shipped === null
    ? join(import.meta.dirname, "ts-check-worker.ts")
    : join(shipped, "ts-check-worker.js")
}
