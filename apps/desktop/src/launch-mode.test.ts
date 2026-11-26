import { expect, test } from "vitest"
import { launchModeFrom, parseLaunchRecord, SAFE_ARGUMENT } from "./launch-mode.ts"

const record = (settled: boolean, quit: boolean) => ({ startedAt: 1, settled, quit })

test("with no record, or an unreadable one, the launch is normal", () => {
  expect(launchModeFrom(null, [])).toEqual({ kind: "normal" })
  expect(launchModeFrom(parseLaunchRecord("{oops"), [])).toEqual({ kind: "normal" })
  expect(launchModeFrom(parseLaunchRecord('{"startedAt":"x"}'), [])).toEqual({ kind: "normal" })
})

test("a previous launch that settled, or quit cleanly, leaves this one normal", () => {
  expect(launchModeFrom(record(true, false), [])).toEqual({ kind: "normal" })
  expect(launchModeFrom(record(false, true), [])).toEqual({ kind: "normal" })
})

test("a previous launch that neither settled nor quit cleanly makes this one safe after a crash", () => {
  expect(launchModeFrom(record(false, false), [])).toEqual({ kind: "safe", reason: "crash" })
})

test("--safe on the command line forces safe mode, whatever the record says", () => {
  expect(launchModeFrom(record(true, true), [SAFE_ARGUMENT])).toEqual({
    kind: "safe",
    reason: "forced",
  })
  expect(launchModeFrom(record(false, false), ["x", SAFE_ARGUMENT])).toEqual({
    kind: "safe",
    reason: "forced",
  })
})

test("a record parses back from what main writes", () => {
  expect(parseLaunchRecord(JSON.stringify(record(true, false)))).toEqual(record(true, false))
})
