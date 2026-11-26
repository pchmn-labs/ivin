import { expect, test } from "vitest"
import { makePluginContext } from "./plugin-context.ts"

test("the context's signal is aborted when the plugin is disposed, and its disposers run last in, first out", () => {
  const { ctx, register, dispose } = makePluginContext()
  const order: string[] = []
  register(() => order.push("first"))
  register(() => order.push("second"))
  ctx.signal.addEventListener("abort", () => order.push("aborted"))
  expect(ctx.signal.aborted).toBe(false)

  const failures = dispose()

  expect(ctx.signal.aborted).toBe(true)
  expect(order).toEqual(["aborted", "second", "first"])
  expect(failures).toEqual([])
})

test("a disposer that throws is reported and does not stop the others", () => {
  const { register, dispose } = makePluginContext()
  const ran: string[] = []
  register(() => ran.push("kept"))
  register(() => {
    throw new Error("boom")
  })

  expect(dispose().map((error) => (error as Error).message)).toEqual(["boom"])
  expect(ran).toEqual(["kept"])
})

test("disposing twice runs the disposers once", () => {
  const { register, dispose } = makePluginContext()
  let runs = 0
  register(() => runs++)
  dispose()
  dispose()
  expect(runs).toBe(1)
})
