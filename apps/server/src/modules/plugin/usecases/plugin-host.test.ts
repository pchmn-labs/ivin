import { Deferred, Effect, Fiber, Layer } from "effect"
import { expect, test } from "vitest"
import { LoginShellPath } from "../../../shared/usecases/login-shell-path.ts"
import {
  layerPluginHostAfterLoginShellPath,
  PluginHost,
  type RunningPluginHost,
} from "./plugin-host.ts"

test("the plugin host starts only once the login shell's PATH is read", async () => {
  let launched = 0
  const gate = Effect.runSync(Deferred.make<void>())
  const host = Layer.succeed(PluginHost)({
    launch: Effect.sync(() => {
      launched++
      return {} as RunningPluginHost
    }),
  })
  const pathRead = Layer.succeed(LoginShellPath)({
    ready: Deferred.await(gate).pipe(Effect.as(null)),
  })

  await Effect.runPromise(
    Effect.gen(function* () {
      const launcher = yield* PluginHost
      const launching = yield* launcher!.launch.pipe(Effect.scoped, Effect.forkChild)
      yield* Effect.yieldNow
      expect(launched).toBe(0)

      yield* Deferred.succeed(gate, undefined)
      yield* Fiber.join(launching)
      expect(launched).toBe(1)
    }).pipe(Effect.provide(layerPluginHostAfterLoginShellPath(host).pipe(Layer.provide(pathRead)))),
  )
})

test("a server without a plugin host still has none", async () => {
  const launcher = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* PluginHost
    }).pipe(Effect.provide(layerPluginHostAfterLoginShellPath(Layer.empty))),
  )
  expect(launcher).toBeNull()
})
