import { expect, test, vi } from "vitest"
import { makeFrameBatch } from "./frame-batch.ts"

const setup = () => {
  const frames: Array<() => void> = []
  const flush = vi.fn()
  const batch = makeFrameBatch<string>({ schedule: (run) => void frames.push(run), flush })
  return { batch, flush, frames, runFrame: () => frames.splice(0).forEach((run) => run()) }
}

test("values pushed within a frame are flushed together, once", () => {
  const { batch, flush, frames, runFrame } = setup()
  batch.push("a")
  batch.push("b")
  expect(frames).toHaveLength(1)
  expect(flush).not.toHaveBeenCalled()
  runFrame()
  expect(flush).toHaveBeenCalledExactlyOnceWith(["a", "b"])
})

test("a push after a flush schedules a new frame", () => {
  const { batch, flush, runFrame } = setup()
  batch.push("a")
  runFrame()
  batch.push("b")
  runFrame()
  expect(flush).toHaveBeenLastCalledWith(["b"])
})

test("dropped values are not flushed", () => {
  const { batch, flush, runFrame } = setup()
  batch.push("a")
  batch.push("b")
  batch.drop((value) => value === "a")
  runFrame()
  expect(flush).toHaveBeenCalledWith(["b"])
})

test("nothing is flushed when every value was dropped", () => {
  const { batch, flush, runFrame } = setup()
  batch.push("a")
  batch.drop(() => true)
  runFrame()
  expect(flush).not.toHaveBeenCalled()
})
