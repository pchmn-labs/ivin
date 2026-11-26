import { Effect, Layer, Stream } from "effect"
import { layerPluginBridge } from "./plugin-bridge.ts"
import { PluginServices } from "./plugin-services.ts"
import { PluginStorage } from "./plugin-storage.ts"

// For a test of the host's run that reaches no module above `plugin`.
export const layerPluginStubs = Layer.mergeAll(
  layerPluginBridge,
  Layer.succeed(PluginStorage)({
    get: () => Effect.succeed(undefined),
    set: () => Effect.void,
  }),
  Layer.succeed(PluginServices)({
    addAnnotation: () => Effect.succeed(null),
    removeAnnotation: () => Effect.void,
    listAnnotations: () => Effect.succeed([]),
    listAllAnnotations: () => Effect.succeed([]),
    listSessions: Effect.succeed([]),
    getSession: () => Effect.succeed(null),
    pluginSettings: Effect.succeed([]),
    pluginSettingChanges: Stream.empty,
  }),
)
