import { Layer } from "effect"
import { join } from "node:path"
import { watchIvinFile } from "../../../shared/adapters/ivin-file.ts"
import { KeybindingsFile } from "../usecases/keybindings-file.ts"

export const layerFsKeybindingsFile = (ivinHome: string) =>
  Layer.succeed(KeybindingsFile)({
    path: join(ivinHome, "keybindings.json"),
    contents: watchIvinFile(ivinHome, "keybindings.json"),
  })
