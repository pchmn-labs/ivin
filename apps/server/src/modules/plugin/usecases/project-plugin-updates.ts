import { Context, Effect, Layer, PubSub, type Scope, Stream } from "effect"

export interface ProjectPluginUpdatesService {
  // Something a `plugin.projectPlugins` snapshot shows may have changed.
  readonly publish: Effect.Effect<void>
  // Subscribed on return, so an update after it is not missed.
  readonly subscribe: Effect.Effect<Stream.Stream<void>, never, Scope.Scope>
}

// Without the Layer nothing is published and nothing is heard.
export const ProjectPluginUpdates = Context.Reference<ProjectPluginUpdatesService>(
  "ivin/server/ProjectPluginUpdates",
  { defaultValue: () => ({ publish: Effect.void, subscribe: Effect.succeed(Stream.empty) }) },
)

export const layerProjectPluginUpdates = Layer.effect(ProjectPluginUpdates)(
  Effect.gen(function* () {
    const bus = yield* PubSub.unbounded<void>()
    return {
      publish: PubSub.publish(bus, undefined).pipe(Effect.asVoid),
      subscribe: Effect.map(PubSub.subscribe(bus), (subscription) =>
        Stream.fromSubscription(subscription),
      ),
    }
  }),
)
