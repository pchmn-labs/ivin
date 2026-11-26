import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { useReportWindowVisible } from "../modules/plugin/hooks/use-report-window-visible.ts"
import {
  RegistryContext,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { Suspense, lazy, useCallback, useContext, useEffect, useRef } from "react"
import { LoadingRows } from "../core/components/loading-rows/loading-rows.tsx"
import { NotificationProvider } from "../core/components/notification/notification.tsx"
import { ErrorMessage } from "../core/components/error-message/error-message.tsx"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { ProjectColumn } from "../modules/project/ui/project-column.tsx"
import { ProjectRail } from "../modules/project/ui/project-rail.tsx"
import { ProjectStrip } from "../modules/project/ui/project-strip.tsx"
import { useStepProject } from "../modules/project/hooks/use-step-project.ts"
import { NoProject, OpenFolderError } from "../modules/project/ui/no-project.tsx"
import { TrustProjectDialog } from "../modules/project/ui/trust-project-dialog.tsx"
import { useReportUncaughtErrors } from "../modules/log/hooks/use-report-uncaught-errors.ts"
import { useRecordSessionVisits } from "../modules/session/hooks/use-session-history.ts"
import { archivedViewOpenAtom } from "../modules/session/atoms/archived-view.ts"
import { SessionActionDialog } from "../modules/session/ui/session-action-dialog.tsx"
import { StartSessionError } from "../modules/session/ui/start-session-error.tsx"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import { tabTranscriptsAtom } from "../modules/transcript/atoms/tab-transcripts.ts"
import { AreaFailureBoundary, MainAreaBoundary } from "./failure-boundary.tsx"
import { StartupNotice } from "../modules/plugin/ui/startup-notice.tsx"
import { PluginsProvider } from "./plugin-host.tsx"
import { Announcements } from "../modules/transcript/ui/announcements.tsx"
import { MainTopBar } from "./main-top-bar.tsx"
import { ShellControls } from "./shell-controls.tsx"
import { SidebarTabs } from "./sidebar-tabs.tsx"
import { SESSIONS_TAB, showSidebarTab, sidebarOpenAtom } from "./sidebar.ts"
import { Slot } from "./slot-renderer.tsx"
import { ResizeHandle } from "../core/components/resize-handle/resize-handle.tsx"
import { restartServer } from "../modules/server/adapters/desktop-server.ts"
import { connectionAtom } from "../modules/server/atoms/connection.ts"
import { useCommandHandler } from "../modules/command/hooks/use-command-handler.ts"
import { KeybindingsFileProblem } from "../modules/keybinding/ui/keybindings-file-problem.tsx"
import { installInShellAtom } from "../modules/cli/atoms/install-in-shell.ts"
import {
  settingsPageOpenAtom,
  settingsSectionAtom,
} from "../modules/setting/atoms/settings-page.ts"
import { useUpdateCommands } from "../modules/update/hooks/use-update-commands.ts"
import { SettingsButton } from "../modules/setting/ui/settings-button.tsx"
import { SettingsNav } from "../modules/setting/ui/settings-nav.tsx"
import { settingsAtom } from "../modules/setting/atoms/settings.ts"
import { useApplyWindowLayout } from "../modules/setting/hooks/use-window-layout.ts"
import "./app.css"

const UpdateButton = lazy(() =>
  import("../modules/update/ui/update-button.tsx").then((m) => ({ default: m.UpdateButton })),
)
const SettingsPage = lazy(() =>
  import("../modules/setting/ui/settings-page.tsx").then((m) => ({ default: m.SettingsPage })),
)

const CARD_MIN = 240
const CARD_MAX = 480
const BOTTOM_MIN = 96
const BOTTOM_MAX_SHARE = 0.7

// `plugins` replaces the built-in plugins the server lists, for a test that has no bundles to import.
export function App({ plugins }: { plugins?: ReadonlyArray<UiPluginEntry> } = {}) {
  const connection = useAtomValue(connectionAtom)
  const { layout } = useAtomValue(settingsAtom).sidebar
  const windowLayout = useApplyWindowLayout()
  const current = useAtomValue(selectedProjectAtom)
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom)
  const registry = useContext(RegistryContext)
  const projectPath = current?.path ?? null

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), [setSidebarOpen])
  useRecordSessionVisits()
  useAtomMount(tabTranscriptsAtom)
  useReportUncaughtErrors()
  useReportWindowVisible()
  useCommandHandler("sidebar.toggle", toggleSidebar, projectPath !== null)
  const { step } = useStepProject()
  useCommandHandler("project.next", () => step(1), projectPath !== null)
  useCommandHandler("project.previous", () => step(-1), projectPath !== null)
  const setArchivedOpen = useAtomSet(archivedViewOpenAtom)
  useCommandHandler(
    "session.showArchived",
    () => {
      setSidebarOpen(true)
      setArchivedOpen(true)
    },
    projectPath !== null,
  )
  const [settingsOpen, setSettingsOpen] = useAtom(settingsPageOpenAtom)
  const focusBeforeSettings = useRef<HTMLElement | null>(null)
  const openSettings = () => {
    if (registry.get(settingsPageOpenAtom)) return
    const focused = document.activeElement
    focusBeforeSettings.current = focused instanceof HTMLElement ? focused : null
    setSettingsOpen(true)
  }
  useUpdateCommands()
  useCommandHandler("settings.open", openSettings)
  useCommandHandler("cli.installInShell", () => {
    registry.set(settingsSectionAtom, "commandLine")
    openSettings()
    registry.set(installInShellAtom, undefined)
  })
  const closeSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen])
  useCommandHandler("settings.close", closeSettings, settingsOpen)
  useEffect(() => {
    if (settingsOpen) return
    focusBeforeSettings.current?.focus()
    focusBeforeSettings.current = null
  }, [settingsOpen])
  useCommandHandler(
    "sidebar.showSessions",
    () => showSidebarTab(registry, SESSIONS_TAB, { focus: true }),
    projectPath !== null,
  )

  const serverLost = (connection.state === "failed" || connection.state === "restarting") && (
    <div className="iv-app__alert">
      <ErrorMessage
        message={connection.text}
        {...(connection.canRestart && {
          action: { label: "Restart", onSelect: () => void restartServer() },
        })}
      />
    </div>
  )

  return (
    <NotificationProvider>
      <PluginsProvider {...(plugins !== undefined && { plugins })} fallback={serverLost || null}>
        {current === null || projectPath === null ? (
          <div
            className="iv-app iv-app--empty"
            data-window-layout={windowLayout}
            hidden={settingsOpen}
          >
            <main className="iv-app__main">
              <MainTopBar projectPath={null} controls={null} />
              {serverLost}
              <StartupNotice />
              <OpenFolderError />
              <TrustProjectDialog />
              <KeybindingsFileProblem />
              <NoProject />
            </main>
          </div>
        ) : (
          <div
            className="iv-app"
            data-window-layout={windowLayout}
            data-sidebar={sidebarOpen ? "open" : "closed"}
            hidden={settingsOpen}
          >
            {sidebarOpen && (
              <aside className="iv-app__card" aria-label="Projects and sessions">
                <div className="iv-app__card-top" data-testid="sidebar-top-row">
                  <ShellControls
                    projectPath={projectPath}
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={toggleSidebar}
                    extra={
                      <>
                        <Suspense fallback={null}>
                          <UpdateButton />
                        </Suspense>
                        <SettingsButton />
                      </>
                    }
                  />
                </div>
                <div className="iv-app__card-body" data-layout={layout}>
                  {layout === "rail" && <ProjectRail />}
                  <ProjectColumn project={current} projectMenu={layout === "strip"}>
                    <SidebarTabs />
                  </ProjectColumn>
                </div>
                <div className="iv-app__bottom">
                  <ResizeHandle
                    label="Resize the bottom panel"
                    edge="top"
                    property="--iv-sidebar-bottom-height"
                    name="sidebar-bottom"
                    min={BOTTOM_MIN}
                    max={(element) => (element.parentElement?.clientHeight ?? 0) * BOTTOM_MAX_SHARE}
                  />
                  <div className="iv-app__bottom-scroll">
                    <Slot slot="sidebar.bottom" props={{}} />
                  </div>
                </div>
                {layout === "strip" && <ProjectStrip />}
                <ResizeHandle
                  label="Resize the sidebar"
                  edge="right"
                  property="--iv-card-width"
                  name="sidebar"
                  min={CARD_MIN}
                  max={() => CARD_MAX}
                />
              </aside>
            )}
            <main className="iv-app__main">
              <MainTopBar
                projectPath={projectPath}
                controls={
                  sidebarOpen ? null : { projectPath, sidebarOpen, onToggleSidebar: toggleSidebar }
                }
              />
              {serverLost}
              <StartupNotice />
              <OpenFolderError />
              <TrustProjectDialog />
              <StartSessionError projectPath={projectPath} />
              <KeybindingsFileProblem />
              <MainAreaBoundary projectPath={projectPath}>
                <TabView projectPath={projectPath} />
              </MainAreaBoundary>
            </main>
            <SessionActionDialog />
            <Announcements projectPath={projectPath} />
            <Slot slot="window.overlay" props={{}} />
          </div>
        )}
        {settingsOpen && (
          // Focusable, so a click on the page keeps the keyboard in its area.
          <div
            className="iv-app"
            data-window-layout={windowLayout}
            data-keybinding-area="settings"
            tabIndex={-1}
          >
            <aside className="iv-app__card" aria-label="Settings">
              <div className="iv-app__card-top" />
              <SettingsNav onClose={closeSettings} />
              <ResizeHandle
                label="Resize the sidebar"
                edge="right"
                property="--iv-card-width"
                name="sidebar"
                min={CARD_MIN}
                max={() => CARD_MAX}
              />
            </aside>
            <main className="iv-app__main">
              <MainTopBar projectPath={null} controls={null} />
              {serverLost}
              <AreaFailureBoundary>
                <Suspense fallback={<LoadingRows label="Loading" />}>
                  <SettingsPage />
                </Suspense>
              </AreaFailureBoundary>
            </main>
          </div>
        )}
      </PluginsProvider>
    </NotificationProvider>
  )
}
