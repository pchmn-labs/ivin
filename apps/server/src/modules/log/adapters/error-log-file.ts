import { Logger, LogLevel, References } from "effect"
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { errorLine, type ErrorSource } from "../rules/error-line.ts"

const errorLogFile = (path: string) =>
  Logger.make(({ message, logLevel, fiber, date }) => {
    if (!LogLevel.isGreaterThanOrEqualTo(logLevel, "Error")) return
    const annotations = fiber.getRef(References.CurrentLogAnnotations)
    const source: ErrorSource = annotations["source"] === "ui" ? "ui" : "server"
    const action = typeof annotations["action"] === "string" ? annotations["action"] : "unknown"
    const error = Array.isArray(message) ? message[0] : message
    // A log that cannot be written is dropped: it must never change how the failed action ends.
    try {
      mkdirSync(dirname(path), { recursive: true })
      appendFileSync(path, `${errorLine(date, source, action, error)}\n`)
    } catch {}
  })

export const layerErrorLogFile = (path: string) =>
  Logger.layer([errorLogFile(path)], { mergeWithExisting: true })
