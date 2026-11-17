import { Rpcs } from "@ivin/contracts/rpcs"
import { Layer } from "effect"
import { layerSqliteProjectStore } from "../modules/project/adapters/sqlite-project-store.ts"
import { getCurrentProject } from "../modules/project/usecases/get-current-project.ts"
import { openProject } from "../modules/project/usecases/open-project.ts"
import { getVersion } from "../modules/server/usecases/get-version.ts"

export const handlers = Rpcs.toLayer({
  "server.getVersion": () => getVersion,
  "project.open": ({ path }) => openProject(path),
  "project.getCurrent": () => getCurrentProject,
}).pipe(Layer.provide(layerSqliteProjectStore))
