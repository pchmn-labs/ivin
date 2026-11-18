import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer, Stream } from "effect"
import { logFailure } from "../modules/log/usecases/log-error.ts"
import { writeError } from "../modules/log/usecases/write-error.ts"
import { layerSqliteProjectStore } from "../modules/project/adapters/sqlite-project-store.ts"
import { closeProject } from "../modules/project/usecases/close-project.ts"
import { listProjects } from "../modules/project/usecases/list-projects.ts"
import { openProject } from "../modules/project/usecases/open-project.ts"
import { selectProject } from "../modules/project/usecases/select-project.ts"
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
import { layerSqliteTabStore } from "../modules/tab/adapters/sqlite-tab-store.ts"
import { closeTab } from "../modules/tab/usecases/close-tab.ts"
import { listTabs } from "../modules/tab/usecases/list-tabs.ts"
import { openTab } from "../modules/tab/usecases/open-tab.ts"
import { reorderTabs } from "../modules/tab/usecases/reorder-tabs.ts"
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
      layerSqliteTabStore,
      layerSqliteTranscriptStore,
      layerItemFeed,
    ),
  ),
)

type Handlers = Record<string, (...args: never[]) => unknown>

const logFailures = <H extends Handlers>(handlers: H): H =>
  Object.fromEntries(
    Object.entries(handlers).map(([action, handler]) => [
      action,
      (...args: never[]) => {
        const result = handler(...args)
        if (Stream.isStream(result))
          return result.pipe(Stream.tapCause((cause) => logFailure(action, cause)))
        if (Effect.isEffect(result))
          return result.pipe(Effect.tapCause((cause) => logFailure(action, cause)))
        return result
      },
    ]),
  ) as H

export const handlers = Rpcs.toLayer(
  logFailures(
    Rpcs.of({
      "server.getVersion": () => getVersion,
      "log.writeError": (report) => writeError(report),
      "project.open": ({ path }) => openProject(path),
      "project.close": ({ path }) => closeProject(path),
      "project.select": ({ path }) => selectProject(path),
      "project.list": () => listProjects,
      "tab.open": ({ sessionId }) => openTab(sessionId),
      "tab.close": ({ sessionId }) => closeTab(sessionId),
      "tab.reorder": ({ projectPath, sessionIds }) => reorderTabs(projectPath, sessionIds),
      "tab.list": ({ projectPath }) => listTabs(projectPath),
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
    }),
  ),
)
