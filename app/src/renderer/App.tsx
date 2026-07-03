import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountMenu } from "./components/AccountMenu";
import { Sidebar } from "./components/Sidebar";
import { Titlebar } from "./components/Titlebar";
import { HomePage } from "./pages/HomePage";
import { InstancesPage } from "./pages/InstancesPage";
import { ModsPage } from "./pages/ModsPage";
import { NewsPage } from "./pages/NewsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useLauncherStore } from "./store/useLauncherStore";

export type Page = "home" | "instances" | "mods" | "news" | "settings";

export function App() {
  const store = useLauncherStore();
  const {
    accounts,
    bootstrap,
    busy,
    error,
    instances,
    launchState,
    mods,
    modrinthResults,
    news,
    notice,
    presetStatuses,
    selectedInstanceId,
    appendLaunchEvent
  } = store;
  const [page, setPage] = useState<Page>("home");

  useEffect(() => {
    void bootstrap();
    return window.monkeyplay.launch.onEvent(appendLaunchEvent);
  }, [appendLaunchEvent, bootstrap]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? instances[0],
    [instances, selectedInstanceId]
  );
  const activeAccount = accounts.find((account) => account.active);

  // Stable references (via getState) so page-level effects that depend on
  // these callbacks never re-run just because unrelated store state changed.
  const launchGame = useCallback((instanceId: string, serverAddress?: string) => {
    void useLauncherStore.getState().launchGame(instanceId, serverAddress);
  }, []);

  const loadMods = useCallback((instanceId: string) => {
    void useLauncherStore.getState().loadMods(instanceId);
  }, []);

  return (
    <div className="app-shell">
      <Titlebar />
      <div className="app-body">
        <Sidebar page={page} onNavigate={setPage} />

        <main className="workspace">
          <div className="workspace-top no-drag">
            <AccountMenu
              accounts={accounts}
              busy={busy}
              onSetActive={(id) => void store.setActiveAccount(id)}
              onDelete={(id) => void store.deleteAccount(id)}
              onCreateOffline={(name) => void store.createOfflineAccount(name)}
              onSignInMicrosoft={() => void store.signInMicrosoft()}
            />
          </div>

          {error ? (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button type="button" className="banner-dismiss" onClick={store.dismissError} aria-label="Dismiss error">
                ✕
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="notice-banner">
              <span>{notice}</span>
              <button type="button" className="banner-dismiss" onClick={store.dismissNotice} aria-label="Dismiss notice">
                ✕
              </button>
            </div>
          ) : null}

          {page === "home" ? (
            <HomePage
              instances={instances}
              selectedInstance={selectedInstance}
              launchState={launchState}
              news={news}
              username={activeAccount?.username}
              onSelectInstance={store.selectInstance}
              onLaunch={launchGame}
              onOpenNews={() => setPage("news")}
            />
          ) : null}

          {page === "instances" ? (
            <InstancesPage
              instances={instances}
              versions={store.versions}
              selectedInstanceId={selectedInstance?.id}
              busy={busy}
              launchBusy={launchState.active && launchState.phase !== "running"}
              maxRamMb={store.totalMemoryMb}
              onCreate={(input) => void store.createInstance(input)}
              onSelect={store.selectInstance}
              onLaunch={(id) => launchGame(id)}
              onUpdate={(id, update) => void store.updateInstance(id, update)}
              onDelete={(id) => void store.deleteInstance(id)}
              onOpenFolder={(path) => void window.monkeyplay.system.openPath(path)}
            />
          ) : null}

          {page === "mods" ? (
            <ModsPage
              instances={instances}
              selectedInstance={selectedInstance}
              mods={mods}
              modrinthResults={modrinthResults}
              presetStatuses={presetStatuses}
              busy={busy}
              onSelectInstance={store.selectInstance}
              onLoadMods={loadMods}
              onToggleMod={(id, file, enabled) => void store.toggleMod(id, file, enabled)}
              onDeleteMod={(id, file) => void store.deleteMod(id, file)}
              onInstallFpsBoost={(id) => void store.installFpsBoost(id)}
              onInstallCompanion={(id) => void store.installCompanion(id)}
              onSearch={(query, type) => void store.searchModrinth(query, type)}
              onInstall={(projectId, instanceId) => void store.installModrinth(projectId, instanceId)}
            />
          ) : null}

          {page === "news" ? <NewsPage news={news} /> : null}

          {page === "settings" ? (
            <SettingsPage
              settings={store.settings}
              java={store.java}
              launches={store.launches}
              totalMemoryMb={store.totalMemoryMb}
              onUpdateSettings={(update) => void store.updateSettings(update)}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
