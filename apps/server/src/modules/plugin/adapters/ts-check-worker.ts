import { createRequire } from "node:module"
import { relative } from "node:path"
import { parentPort, workerData } from "node:worker_threads"
import type * as Ts from "typescript-compiler-api"

const { folder, typescript, paths } = workerData as {
  folder: string
  typescript: string
  paths: Record<string, string[]>
}
const ts = createRequire(import.meta.url)(typescript) as typeof Ts

const run = (): { lines: string[] } | { failure: string } => {
  const configFile = ts.findConfigFile(folder, (file) => ts.sys.fileExists(file), "tsconfig.json")
  if (configFile === undefined || relative(folder, configFile).startsWith("..")) {
    return { failure: "The plugin has no tsconfig.json; ivin plugin new writes one." }
  }
  const read = ts.readConfigFile(configFile, (file) => ts.sys.readFile(file))
  if (read.error !== undefined) {
    return {
      failure: `tsconfig.json: ${ts.flattenDiagnosticMessageText(read.error.messageText, " ")}`,
    }
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, folder)
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    // The app's own types win, wherever the app sits now.
    options: { ...parsed.options, noEmit: true, paths: { ...parsed.options.paths, ...paths } },
    ...(parsed.projectReferences === undefined
      ? {}
      : { projectReferences: parsed.projectReferences }),
  })
  const lines = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")
    const category = ts.DiagnosticCategory[diagnostic.category].toLowerCase()
    if (diagnostic.file === undefined || diagnostic.start === undefined) {
      return `${category} TS${diagnostic.code}: ${message}`
    }
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    const file = relative(folder, diagnostic.file.fileName)
    return `${file}(${line + 1},${character + 1}): ${category} TS${diagnostic.code}: ${message}`
  })
  return { lines }
}

parentPort?.postMessage(run())
