import { Layer } from "effect"
import { watchIvinFile } from "../../../shared/adapters/ivin-file.ts"
import { SettingsFile } from "../usecases/settings-file.ts"

export const layerFsSettingsFile = (ivinHome: string) =>
  Layer.succeed(SettingsFile)({ contents: watchIvinFile(ivinHome, "settings.json") })
