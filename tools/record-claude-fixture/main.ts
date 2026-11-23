import { fileURLToPath } from "node:url"
import { record } from "./record.ts"
import { parseRecording } from "./recording.ts"

const FIXTURES = fileURLToPath(
  new URL("../../packages/harness/src/modules/claude/rules/fixtures", import.meta.url),
)

const recording = parseRecording(process.argv.slice(2))
if (typeof recording === "string") {
  console.error(recording)
  process.exit(2)
}

const outcome = await record(recording, FIXTURES)
const path = `${FIXTURES}/${recording.name}.jsonl`
if (!outcome.ok) {
  console.error(`${outcome.reason}; ${path} is left as it was`)
  process.exit(1)
}
console.log(`Wrote ${outcome.lines} lines to ${path}`)
