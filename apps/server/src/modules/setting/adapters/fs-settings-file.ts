import { SettingsFileUnavailable } from "@ivin/contracts/setting"
import { Effect, Layer, Semaphore } from "effect"
import { join } from "node:path"
import { readText, watchIvinFile, writeText } from "../../../shared/adapters/ivin-file.ts"
import { SettingsFile } from "../usecases/settings-file.ts"

export const layerFsSettingsFile = (ivinHome: string) =>
  Layer.effect(SettingsFile)(
    Effect.gen(function* () {
      const path = join(ivinHome, "settings.json")
      const lock = yield* Semaphore.make(1)
      const read = readText(path).pipe(
        Effect.mapError(() => new SettingsFileUnavailable({ path, action: "read" })),
      )
      return {
        path,
        contents: watchIvinFile(ivinHome, "settings.json"),
        read,
        edit: (change) =>
          lock.withPermits(1)(
            read.pipe(
              Effect.flatMap(change),
              Effect.flatMap((text) =>
                writeText(path, text).pipe(
                  Effect.mapError(() => new SettingsFileUnavailable({ path, action: "write" })),
                ),
              ),
            ),
          ),
      }
    }),
  )
