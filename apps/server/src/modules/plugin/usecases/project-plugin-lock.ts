import { Context, Effect, Layer, Semaphore } from "effect"

export interface ProjectPluginLockService {
  // One reconciliation of the trust state at a time, so two listings never record the same change twice.
  readonly exclusive: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

// Without the Layer nothing is serialized.
export const ProjectPluginLock = Context.Reference<ProjectPluginLockService>(
  "ivin/server/ProjectPluginLock",
  { defaultValue: () => ({ exclusive: (effect) => effect }) },
)

export const layerProjectPluginLock = Layer.effect(ProjectPluginLock)(
  Effect.map(Semaphore.make(1), (lock) => ({ exclusive: lock.withPermits(1) })),
)
