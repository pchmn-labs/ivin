import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer, Stream } from "effect"
import { layerSqliteAnnotationStore } from "../modules/annotation/adapters/sqlite-annotation-store.ts"
import { addAnnotation } from "../modules/annotation/usecases/add-annotation.ts"
import { layerAnnotationFeed } from "../modules/annotation/usecases/annotation-feed.ts"
import { listAnnotations } from "../modules/annotation/usecases/list-annotations.ts"
import { removeAnnotation } from "../modules/annotation/usecases/remove-annotation.ts"
import { watchAnnotations } from "../modules/annotation/usecases/watch-annotations.ts"
import { getShellInstall } from "../modules/cli/usecases/get-shell-install.ts"
import { installInShell } from "../modules/cli/usecases/install-in-shell.ts"
import { layerFsFileReader } from "../modules/file/adapters/fs-file-reader.ts"
import { layerFsFileWriter } from "../modules/file/adapters/fs-file-writer.ts"
import { layerFsFolderReader } from "../modules/file/adapters/fs-folder-reader.ts"
import { layerFsFolderWatcher } from "../modules/file/adapters/fs-folder-watcher.ts"
import { listFiles } from "../modules/file/usecases/list-files.ts"
import { readGitStatus } from "../modules/file/usecases/read-git-status.ts"
import { layerSharedFolderWatch } from "../modules/file/usecases/shared-folder-watch.ts"
import { watchFolder } from "../modules/file/usecases/watch-folder.ts"
import { listFolder } from "../modules/file/usecases/list-folder.ts"
import { readFile } from "../modules/file/usecases/read-file.ts"
import { listChanges } from "../modules/file/usecases/list-changes.ts"
import { readDiff } from "../modules/file/usecases/read-diff.ts"
import { writeFile } from "../modules/file/usecases/write-file.ts"
import { logFailure } from "../modules/log/usecases/log-error.ts"
import { writeError } from "../modules/log/usecases/write-error.ts"
import { listPlugins } from "../modules/plugin/usecases/list-plugins.ts"
import { lockPlugin } from "../modules/plugin/usecases/lock-plugin.ts"
import { readPluginLog } from "../modules/plugin/usecases/read-plugin-log.ts"
import { reportPluginFailure } from "../modules/plugin/usecases/report-plugin-failure.ts"
import { watchKeybindings } from "../modules/keybinding/usecases/watch-keybindings.ts"
import { layerSqliteProjectStore } from "../modules/project/adapters/sqlite-project-store.ts"
import { closeProject } from "../modules/project/usecases/close-project.ts"
import { listProjects } from "../modules/project/usecases/list-projects.ts"
import { openProject } from "../modules/project/usecases/open-project.ts"
import { selectProject } from "../modules/project/usecases/select-project.ts"
import { doctor } from "../modules/server/usecases/doctor.ts"
import { getHarness } from "../modules/server/usecases/get-harness.ts"
import { getVersion } from "../modules/server/usecases/get-version.ts"
import { layerSqliteSessionStore } from "../modules/session/adapters/sqlite-session-store.ts"
import { archiveSession } from "../modules/session/usecases/archive-session.ts"
import { deleteSession } from "../modules/session/usecases/delete-session.ts"
import { listArchivedSessions } from "../modules/session/usecases/list-archived-sessions.ts"
import { restoreSession } from "../modules/session/usecases/restore-session.ts"
import { answerApproval } from "../modules/session/usecases/answer-approval.ts"
import { interruptSession } from "../modules/session/usecases/interrupt-session.ts"
import { sendNow } from "../modules/session/usecases/send-now.ts"
import { createSession } from "../modules/session/usecases/create-session.ts"
import { listSessions } from "../modules/session/usecases/list-sessions.ts"
import { pickBranch } from "../modules/session/usecases/pick-branch.ts"
import { pickWorkingFolder } from "../modules/session/usecases/pick-working-folder.ts"
import { renameSession } from "../modules/session/usecases/rename-session.ts"
import { fastForward } from "../modules/session/usecases/fast-forward.ts"
import { switchToDefaultBranch } from "../modules/session/usecases/switch-to-default-branch.ts"
import { setRunOptions } from "../modules/session/usecases/set-run-options.ts"
import { sendMessage } from "../modules/session/usecases/send-message.ts"
import { layerSessionFeed } from "../modules/session/usecases/session-feed.ts"
import { layerSessionRuns } from "../modules/session/usecases/session-runs.ts"
import { watchSessions } from "../modules/session/usecases/watch-sessions.ts"
import { layerCurrentSettings } from "../modules/setting/usecases/current-settings.ts"
import { getSetting } from "../modules/setting/usecases/get-setting.ts"
import { setSetting } from "../modules/setting/usecases/set-setting.ts"
import { watchSettings } from "../modules/setting/usecases/watch-settings.ts"
import { layerSqliteTabStore } from "../modules/tab/adapters/sqlite-tab-store.ts"
import { closeSubView } from "../modules/tab/usecases/close-sub-view.ts"
import { closeTab } from "../modules/tab/usecases/close-tab.ts"
import { listSubViews } from "../modules/tab/usecases/list-sub-views.ts"
import { listTabs } from "../modules/tab/usecases/list-tabs.ts"
import { openSubView } from "../modules/tab/usecases/open-sub-view.ts"
import { openTab } from "../modules/tab/usecases/open-tab.ts"
import { reorderTabs } from "../modules/tab/usecases/reorder-tabs.ts"
import { selectSessionTab } from "../modules/tab/usecases/select-session-tab.ts"
import { setFullWidth } from "../modules/tab/usecases/set-full-width.ts"
import { layerSqliteTranscriptStore } from "../modules/transcript/adapters/sqlite-transcript-store.ts"
import { layerFsImageStore } from "../modules/transcript/adapters/fs-image-store.ts"
import { getItems } from "../modules/transcript/usecases/get-items.ts"
import { layerImageCompression } from "../modules/transcript/usecases/image-compression.ts"
import { listImages } from "../modules/transcript/usecases/list-images.ts"
import { layerItemFeed } from "../modules/transcript/usecases/item-feed.ts"
import { watchItems } from "../modules/transcript/usecases/watch-items.ts"
import { layerGitCli } from "../modules/worktree/adapters/git-cli.ts"
import { layerOriginFetch } from "../modules/worktree/usecases/origin-fetch.ts"
import { layerWorktreeCleanup } from "../modules/worktree/usecases/worktree-cleanup.ts"
import { checkoutStatus } from "../modules/worktree/usecases/checkout-status.ts"
import { listBranches } from "../modules/worktree/usecases/list-branches.ts"
import { listWorktrees } from "../modules/worktree/usecases/list-worktrees.ts"
import { newWorktreeBase } from "../modules/worktree/usecases/new-worktree-base.ts"

export const layerServices = Layer.mergeAll(layerWorktreeCleanup, layerImageCompression).pipe(
  Layer.provideMerge(Layer.mergeAll(layerSessionRuns, layerCurrentSettings)),
  Layer.provideMerge(layerSessionFeed),
  Layer.provideMerge(layerOriginFetch),
  Layer.provideMerge(layerSharedFolderWatch),
  Layer.provideMerge(
    Layer.mergeAll(
      layerGitCli,
      layerFsFolderReader,
      layerFsFolderWatcher,
      layerFsFileReader,
      layerFsFileWriter,
      layerSqliteProjectStore,
      layerSqliteSessionStore,
      layerSqliteTabStore,
      layerSqliteTranscriptStore,
      layerFsImageStore,
      layerItemFeed,
      layerSqliteAnnotationStore,
      layerAnnotationFeed,
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
      "server.getHarness": () => getHarness,
      "server.doctor": () => doctor,
      "annotation.add": ({ target, ns, kind, data }) => addAnnotation(target, ns, kind, data),
      "annotation.remove": ({ id }) => removeAnnotation(id),
      "annotation.list": ({ target, kind }) => listAnnotations(target, kind),
      "annotation.watch": ({ target }) => watchAnnotations(target),
      "cli.getShellInstall": () => getShellInstall,
      "cli.installInShell": () => installInShell,
      "keybinding.watch": () => watchKeybindings,
      "log.writeError": (report) => writeError(report),
      "plugin.list": () => listPlugins,
      "plugin.reportFailure": ({ id, reason }) => reportPluginFailure(id, reason),
      "plugin.readLog": ({ id }) => readPluginLog(id),
      "plugin.lock": ({ id }) => lockPlugin(id),
      "setting.watch": () => watchSettings,
      "setting.get": ({ path }) => getSetting(path),
      "setting.set": ({ path, value }) => setSetting(path, value),
      "project.open": ({ path }) => openProject(path),
      "project.close": ({ path }) => closeProject(path),
      "project.select": ({ path }) => selectProject(path),
      "project.list": () => listProjects,
      "tab.open": ({ sessionId }) => openTab(sessionId),
      "tab.close": ({ sessionId }) => closeTab(sessionId),
      "tab.reorder": ({ projectPath, sessionIds }) => reorderTabs(projectPath, sessionIds),
      "tab.list": ({ projectPath }) => listTabs(projectPath),
      "tab.listSubViews": ({ sessionId }) => listSubViews(sessionId),
      "tab.openSubView": ({ sessionId, subView }) => openSubView(sessionId, subView),
      "tab.closeSubView": ({ sessionId, subView }) => closeSubView(sessionId, subView),
      "tab.setFullWidth": ({ sessionId, fullWidth }) => setFullWidth(sessionId, fullWidth),
      "tab.selectSessionTab": ({ sessionId }) => selectSessionTab(sessionId),
      "session.create": ({ projectPath }) => createSession(projectPath),
      "session.setRunOptions": ({ sessionId, options }) => setRunOptions(sessionId, options),
      "session.list": ({ projectPath }) => listSessions(projectPath),
      "session.listArchived": ({ projectPath }) => listArchivedSessions(projectPath),
      "session.archive": ({ sessionId }) => archiveSession(sessionId),
      "session.restore": ({ sessionId }) => restoreSession(sessionId),
      "session.delete": ({ sessionId }) => deleteSession(sessionId),
      "session.rename": ({ sessionId, title, by }) => renameSession(sessionId, title, by),
      "session.sendMessage": ({ sessionId, messageId, text, images = [], workingFolder }) =>
        sendMessage(sessionId, messageId, text, images, workingFolder),
      "session.pickWorkingFolder": ({ sessionId, workingFolder }) =>
        pickWorkingFolder(sessionId, workingFolder),
      "session.answerApproval": ({ sessionId, requestId, allow }) =>
        answerApproval(sessionId, requestId, allow),
      "session.pickBranch": ({ sessionId, name, remote }) => pickBranch(sessionId, name, remote),
      "session.interrupt": ({ sessionId }) => interruptSession(sessionId),
      "session.sendNow": ({ sessionId }) => sendNow(sessionId),
      "session.switchToDefaultBranch": ({ sessionId, localChanges }) =>
        switchToDefaultBranch(sessionId, localChanges),
      "session.fastForward": ({ sessionId, stash }) => fastForward(sessionId, stash),
      "session.watch": ({ projectPath }) => watchSessions(projectPath),
      "worktree.list": ({ projectPath }) => listWorktrees(projectPath),
      "worktree.newBase": ({ projectPath }) =>
        newWorktreeBase(projectPath).pipe(
          // Git fails outside a repository, where no worktree can start.
          Effect.orElseSucceed(() => null),
        ),
      "worktree.checkoutStatus": ({ projectPath }) =>
        checkoutStatus(projectPath).pipe(
          Effect.tapError((error) =>
            Effect.logWarning(`could not read the checkout of ${projectPath}`, error),
          ),
          // Git fails outside a repository, where there is nothing to switch or pull.
          Effect.orElseSucceed(() => null),
        ),
      "worktree.listBranches": ({ projectPath }) => listBranches(projectPath),
      "file.listFolder": ({ sessionId, path }) => listFolder(sessionId, path),
      "file.readFile": ({ sessionId, path }) => readFile(sessionId, path),
      "file.listFiles": ({ sessionId }) => listFiles(sessionId),
      "file.gitStatus": ({ sessionId }) => readGitStatus(sessionId),
      "file.listChanges": ({ sessionId }) => listChanges(sessionId),
      "file.readDiff": ({ sessionId, path }) => readDiff(sessionId, path),
      "file.watch": ({ sessionId }) => watchFolder(sessionId),
      "file.writeFile": ({ sessionId, path, text, expectedVersion }) =>
        writeFile(sessionId, path, text, expectedVersion),
      "transcript.getItems": ({ sessionId, position, before, after }) =>
        getItems(sessionId, position, before, after),
      "transcript.watchItems": ({ sessionId, before }) => watchItems(sessionId, before),
      "transcript.listImages": ({ sessionId }) => listImages(sessionId),
    }),
  ),
)
