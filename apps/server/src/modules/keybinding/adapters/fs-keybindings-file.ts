import { Layer } from "effect"
import { watchIvinFile } from "../../../shared/adapters/ivin-file.ts"
import { KeybindingsFile } from "../usecases/keybindings-file.ts"

export const layerFsKeybindingsFile = (ivinHome: string) =>
  Layer.succeed(KeybindingsFile)({ contents: watchIvinFile(ivinHome, "keybindings.json") })
