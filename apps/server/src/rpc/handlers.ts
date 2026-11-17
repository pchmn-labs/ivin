import { Rpcs } from "@ivin/contracts/rpcs"
import { Layer } from "effect"
import { layerSqliteProjectStore } from "../modules/project/adapters/sqlite-project-store.ts"
import { getCurrentProject } from "../modules/project/usecases/get-current-project.ts"
import { openProject } from "../modules/project/usecases/open-project.ts"
import { getVersion } from "../modules/server/usecases/get-version.ts"
import { layerSqliteSessionStore } from "../modules/session/adapters/sqlite-session-store.ts"
import { answerApproval } from "../modules/session/usecases/answer-approval.ts"
import { interruptSession } from "../modules/session/usecases/interrupt-session.ts"
import { createSession } from "../modules/session/usecases/create-session.ts"
import { listSessions } from "../modules/session/usecases/list-sessions.ts"
import { renameSession } from "../modules/session/usecases/rename-session.ts"
import { sendMessage } from "../modules/session/usecases/send-message.ts"
import { layerSessionFeed } from "../modules/session/usecases/session-feed.ts"
import { layerSessionRuns } from "../modules/session/usecases/session-runs.ts"
import { watchSessions } from "../modules/session/usecases/watch-sessions.ts"
import { layerSqliteTranscriptStore } from "../modules/transcript/adapters/sqlite-transcript-store.ts"
import { getItems } from "../modules/transcript/usecases/get-items.ts"
import { layerItemFeed } from "../modules/transcript/usecases/item-feed.ts"
import { watchItems } from "../modules/transcript/usecases/watch-items.ts"

export const layerServices = layerSessionRuns.pipe(
  Layer.provideMerge(layerSessionFeed),
  Layer.provideMerge(
    Layer.mergeAll(
      layerSqliteProjectStore,
      layerSqliteSessionStore,
      layerSqliteTranscriptStore,
      layerItemFeed,
    ),
  ),
)

export const handlers = Rpcs.toLayer({
  "server.getVersion": () => getVersion,
  "project.open": ({ path }) => openProject(path),
  "project.getCurrent": () => getCurrentProject,
  "session.create": ({ projectPath, model }) => createSession(projectPath, model),
  "session.list": ({ projectPath }) => listSessions(projectPath),
  "session.rename": ({ sessionId, title }) => renameSession(sessionId, title),
  "session.sendMessage": ({ sessionId, messageId, text }) =>
    sendMessage(sessionId, messageId, text),
  "session.answerApproval": ({ sessionId, requestId, allow }) =>
    answerApproval(sessionId, requestId, allow),
  "session.interrupt": ({ sessionId }) => interruptSession(sessionId),
  "session.watch": ({ projectPath }) => watchSessions(projectPath),
  "transcript.getItems": ({ sessionId, position, before, after }) =>
    getItems(sessionId, position, before, after),
  "transcript.watchItems": ({ sessionId, before }) => watchItems(sessionId, before),
})
