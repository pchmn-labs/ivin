import { Layer } from "effect"
import { join } from "node:path"
import { watchIvinFile } from "../../../shared/adapters/ivin-file.ts"
import { SettingsFile } from "../usecases/settings-file.ts"

export const layerFsSettingsFile = (ivinHome: string) =>
  Layer.succeed(SettingsFile)({
    path: join(ivinHome, "settings.json"),
    contents: watchIvinFile(ivinHome, "settings.json"),
  })
