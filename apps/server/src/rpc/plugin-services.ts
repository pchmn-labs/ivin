import { Effect, Layer, Stream } from "effect"
import { addAnnotation } from "../modules/annotation/usecases/add-annotation.ts"
import { AnnotationStore } from "../modules/annotation/usecases/annotation-store.ts"
import { listAnnotations } from "../modules/annotation/usecases/list-annotations.ts"
import { removeAnnotation } from "../modules/annotation/usecases/remove-annotation.ts"
import { apiValues } from "../modules/plugin/rules/api-values.ts"
import { PluginCallFailed, PluginServices } from "../modules/plugin/usecases/plugin-services.ts"
import { SessionStore } from "../modules/session/usecases/session-store.ts"
import { CurrentSettings } from "../modules/setting/usecases/current-settings.ts"
import { AnnotationFeed } from "../modules/annotation/usecases/annotation-feed.ts"

const reason = (error: { readonly _tag: string }) => `${error._tag}`

export const layerPluginServices = Layer.effect(PluginServices)(
  Effect.gen(function* () {
    const store = yield* AnnotationStore
    yield* AnnotationFeed
    const sessions = yield* SessionStore
    const settings = yield* CurrentSettings
    const context = yield* Effect.context<AnnotationStore | AnnotationFeed>()
    const failing = <A, E extends { readonly _tag: string }>(
      effect: Effect.Effect<A, E, AnnotationStore | AnnotationFeed>,
    ) =>
      effect.pipe(
        Effect.provideContext(context),
        Effect.mapError((error) => new PluginCallFailed({ reason: reason(error) })),
      )
    return {
      addAnnotation: (ns, target, kind, data) =>
        failing(addAnnotation(target, ns, kind, data)).pipe(Effect.map(apiValues)),
      removeAnnotation: (ns, id) =>
        Effect.gen(function* () {
          const annotation = yield* store.find(id)
          if (annotation !== null && annotation.ns !== ns) {
            return yield* new PluginCallFailed({
              reason: "The annotation belongs to another plugin.",
            })
          }
          yield* failing(removeAnnotation(id))
        }),
      listAnnotations: (ns, target, kind) =>
        failing(listAnnotations(target, kind)).pipe(
          Effect.map((all) => all.filter((annotation) => annotation.ns === ns).map(apiValues)),
        ),
      listAllAnnotations: (target, kind) =>
        failing(listAnnotations(target, kind)).pipe(Effect.map((all) => all.map(apiValues))),
      listSessions: sessions.listAll.pipe(
        Effect.map((all) => all.filter((session) => session.archivedAt === null).map(apiValues)),
      ),
      getSession: (sessionId) =>
        sessions
          .findById(sessionId)
          .pipe(
            Effect.map((session) =>
              session === null || session.archivedAt !== null ? null : apiValues(session),
            ),
          ),
      pluginSettings: settings.pluginSettings,
      pluginSettingChanges: settings.changes.pipe(Stream.map((user) => user.pluginSettings ?? [])),
    }
  }),
)
