import {
  RegistryContext,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useCallback, useContext, useEffect, useRef } from "react"
import { ErrorMessage } from "../core/components/error-message/error-message.tsx"
import { Tooltip } from "../core/components/tooltip/tooltip.tsx"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { ProjectColumn } from "../modules/project/ui/project-column.tsx"
import { ProjectRail } from "../modules/project/ui/project-rail.tsx"
import { NoProject, OpenFolderError } from "../modules/project/ui/no-project.tsx"
import { useReportUncaughtErrors } from "../modules/log/hooks/use-report-uncaught-errors.ts"
import { useRecordSessionVisits } from "../modules/session/hooks/use-session-history.ts"
import { archivedViewOpenAtom } from "../modules/session/atoms/archived-view.ts"
import { SessionActionDialog } from "../modules/session/ui/session-action-dialog.tsx"
import { StartSessionError } from "../modules/session/ui/start-session-error.tsx"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import { tabTranscriptsAtom } from "../modules/transcript/atoms/tab-transcripts.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import { builtinPlugins } from "./builtin-plugins.ts"
import { MainTopBar } from "./main-top-bar.tsx"
import { ShellControls } from "./shell-controls.tsx"
import { SidebarTabs } from "./sidebar-tabs.tsx"
import { SESSIONS_TAB, showSidebarTab, sidebarOpenAtom } from "./sidebar.ts"
import { Slot } from "./slot-renderer.tsx"
import { ResizeHandle } from "../core/components/resize-handle/resize-handle.tsx"
import { getVersionAtom } from "../modules/server/atoms/get-version.ts"
import { useCommandHandler } from "../modules/command/hooks/use-command-handler.ts"
import { KeybindingsFileProblem } from "../modules/keybinding/ui/keybindings-file-problem.tsx"
import { installInShellAtom } from "../modules/cli/atoms/install-in-shell.ts"
import {
  settingsPageOpenAtom,
  settingsSectionAtom,
} from "../modules/setting/atoms/settings-page.ts"
import { SettingsButton } from "../modules/setting/ui/settings-button.tsx"
import { SettingsNav } from "../modules/setting/ui/settings-nav.tsx"
import { SettingsPage } from "../modules/setting/ui/settings-page.tsx"
import "./app.css"

const CARD_MIN = 240
const CARD_MAX = 480
const BOTTOM_MIN = 96
const BOTTOM_MAX_SHARE = 0.7

export function App() {
  const result = useAtomValue(getVersionAtom)
  const current = useAtomValue(selectedProjectAtom)
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom)
  const registry = useContext(RegistryContext)
  const projectPath = current?.path ?? null

  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), [setSidebarOpen])
  useRecordSessionVisits()
  useAtomMount(tabTranscriptsAtom)
  useReportUncaughtErrors()
  useCommandHandler("sidebar.toggle", toggleSidebar, projectPath !== null)
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

  const connection = AsyncResult.match(result, {
    onInitial: () => ({ state: "connecting", text: "Connecting to the server…" }),
    onFailure: () => ({
      state: "failed",
      text: "ivin's server is not answering. Quit and reopen ivin.",
    }),
    onSuccess: ({ value }) => ({ state: "connected", text: `Server ${value}` }),
  })
  const version = (
    <Tooltip content={connection.text} side="right">
      <span className="iv-connection" data-state={connection.state} data-testid="server-version">
        <span className="iv-visually-hidden">{connection.text}</span>
      </span>
    </Tooltip>
  )
  // The desktop app does not restart a lost server, so a retry cannot work.
  const serverLost = connection.state === "failed" && (
    <div className="iv-app__alert">
      <ErrorMessage message={connection.text} />
    </div>
  )

  return (
    <PluginsProvider plugins={builtinPlugins}>
      {current === null || projectPath === null ? (
        <div className="iv-app iv-app--empty" hidden={settingsOpen}>
          <main className="iv-app__main">
            <MainTopBar projectPath={null} controls={null} />
            {serverLost}
            <OpenFolderError />
            <KeybindingsFileProblem />
            <NoProject />
          </main>
          <div className="iv-app__corner">{version}</div>
        </div>
      ) : (
        <div
          className="iv-app"
          data-sidebar={sidebarOpen ? "open" : "closed"}
          hidden={settingsOpen}
        >
          {sidebarOpen && (
            <aside className="iv-app__card" aria-label="Projects and sessions">
              <div className="iv-app__card-top">
                <ShellControls
                  projectPath={projectPath}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={toggleSidebar}
                />
              </div>
              <div className="iv-app__card-body">
                <ProjectRail
                  footer={
                    <>
                      <SettingsButton />
                      {version}
                    </>
                  }
                />
                <ProjectColumn project={current}>
                  <SidebarTabs project={current} />
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
            <OpenFolderError />
            <StartSessionError projectPath={projectPath} />
            <KeybindingsFileProblem />
            <TabView projectPath={projectPath} />
          </main>
          <SessionActionDialog />
          <Slot slot="window.overlay" props={{}} />
        </div>
      )}
      {settingsOpen && (
        // Focusable, so a click on the page keeps the keyboard in its area.
        <div className="iv-app" data-keybinding-area="settings" tabIndex={-1}>
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
            <SettingsPage />
          </main>
        </div>
      )}
    </PluginsProvider>
  )
}
