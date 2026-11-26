import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type { TypePaths } from "../rules/plugin-template.ts"

// The desktop app ships the plugin API's sources and the packages they import beside the server bundle (`tsdown.config.ts`).
// Packaged, files that Node must read from disk sit unpacked beside the asar.
export const unpackedFolder = import.meta.dirname.replace(/app\.asar(?=[/\\])/, "app.asar.unpacked")

const shipped = join(unpackedFolder, "plugin-types")

const apiSources = () =>
  existsSync(shipped)
    ? join(shipped, "plugin-api", "src")
    : dirname(createRequire(import.meta.url).resolve("@ivin/plugin-api/server"))

const packageFolder = (from: string, name: string) => {
  try {
    return dirname(createRequire(join(from, "x.ts")).resolve(`${name}/package.json`))
  } catch {
    return null
  }
}

export const pluginTypePaths = (): TypePaths => {
  const api = apiSources()
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

// Run by the checker's worker: the compiler ships beside the server bundle, and a source checkout reads its own.
export const typescriptFile = () => {
  const bundled = join(unpackedFolder, "typescript", "typescript.cjs")
  return existsSync(bundled)
    ? bundled
    : createRequire(import.meta.url).resolve("typescript-compiler-api")
}
