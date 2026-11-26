import type { AnnotationTarget } from "@ivin/contracts/annotation"
import type { PluginSetting } from "@ivin/contracts/setting"
import { Context, Data, type Effect, type Schema, type Stream } from "effect"

export class PluginCallFailed extends Data.TaggedError("PluginCallFailed")<{
  readonly reason: string
}> {}

// What a server half's `ctx` reaches in modules above `plugin`; `rpc/` builds the Layer.
export class PluginServices extends Context.Service<
  PluginServices,
  {
    readonly addAnnotation: (
      ns: string,
      target: AnnotationTarget,
      kind: string,
      data: Schema.Json,
    ) => Effect.Effect<unknown, PluginCallFailed>
    // Refuses an annotation of another namespace.
    readonly removeAnnotation: (ns: string, id: string) => Effect.Effect<void, PluginCallFailed>
    readonly listAnnotations: (
      ns: string,
      target: AnnotationTarget,
      kind: string | null,
    ) => Effect.Effect<ReadonlyArray<unknown>, PluginCallFailed>
    // Every namespace's annotations, for reading.
    readonly listAllAnnotations: (
      target: AnnotationTarget,
      kind: string | null,
    ) => Effect.Effect<ReadonlyArray<unknown>, PluginCallFailed>
    // The sessions of every project, archived ones left out.
    readonly listSessions: Effect.Effect<ReadonlyArray<unknown>>
    readonly getSession: (sessionId: string) => Effect.Effect<unknown>
    readonly pluginSettings: Effect.Effect<ReadonlyArray<PluginSetting>>
    // The current settings first, then each change.
    readonly pluginSettingChanges: Stream.Stream<ReadonlyArray<PluginSetting>>
  }
>()("ivin/server/PluginServices") {}
