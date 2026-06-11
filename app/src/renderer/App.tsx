import type { LoaderType } from "@shared/types";
import {
  Download,
  HardDrive,
  KeyRound,
  PackageSearch,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { InstanceCard } from "./components/InstanceCard";
import { LogsPanel } from "./components/LogsPanel";
import { useLauncherStore } from "./store/useLauncherStore";
import monkeyIcon from "./assets/monkey.png";

const loaderOptions: LoaderType[] = ["vanilla", "fabric", "quilt", "forge", "neoforge"];

export function App() {
  const {
    accounts,
    bootstrap,
    busy,
    createInstance,
    createOfflineAccount,
    deleteAccount,
    deleteInstance,
    dismissError,
    error,
    installModrinth,
    instances,
    java,
    launchOffline,
    launches,
    modrinthResults,
    notice,
    searchModrinth,
    selectedInstanceId,
    selectInstance,
    setActiveAccount,
    settings,
    totalMemoryMb,
    updateInstance,
    updateSettings,
    appendLaunchEvent
  } = useLauncherStore();
  const [instanceName, setInstanceName] = useState("Monkey Vanilla");
  const [version, setVersion] = useState("1.21.4");
  const [loader, setLoader] = useState<LoaderType>("fabric");
  const [offlineName, setOfflineName] = useState("Player");
  const [search, setSearch] = useState("sodium");
  const [projectType, setProjectType] = useState<"mod" | "shader">("mod");

  useEffect(() => {
    void bootstrap();
    return window.monkeyplay.launch.onEvent(appendLaunchEvent);
  }, [appendLaunchEvent, bootstrap]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? instances[0],
    [instances, selectedInstanceId]
  );
  const activeAccount = accounts.find((account) => account.active);

  function handleCreateInstance(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void createInstance({ name: instanceName, minecraftVersion: version, loader });
  }

  function handleOfflineAccount(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void createOfflineAccount(offlineName);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void searchModrinth(search, projectType);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <img className="brand-block" src={monkeyIcon} alt="MonkeyPlay" />
          <div>
            <strong>MonkeyPlay</strong>
            <span>Java Edition Launcher</span>
          </div>
        </div>
        <nav className="nav-stack" aria-label="Primary">
          <a href="#instances">
            <HardDrive size={18} />
            Instances
          </a>
          <a href="#mods">
            <PackageSearch size={18} />
            Mods &amp; Shaders
          </a>
          <a href="#accounts">
            <KeyRound size={18} />
            Accounts
          </a>
          <a href="#settings">
            <SlidersHorizontal size={18} />
            Settings
          </a>
        </nav>
        <div className="boundary-note">
          <ShieldCheck size={18} />
          <span>Fair-play client. Vanilla-equivalent hitboxes only — no cheat modules.</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Active instance</p>
            <h1>{selectedInstance?.name ?? "No instance"}</h1>
            {selectedInstance ? (
              <p className="topbar-sub">
                {selectedInstance.minecraftVersion} · {selectedInstance.loader} ·{" "}
                {activeAccount ? `${activeAccount.username} (${activeAccount.type})` : "no account"}
              </p>
            ) : null}
          </div>
          <div className="topbar-actions">
            <button type="button" className="secondary-button" onClick={() => void bootstrap()} disabled={busy}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              type="button"
              className="primary-button play-button"
              disabled={!selectedInstance || busy}
              onClick={() => selectedInstance && void launchOffline(selectedInstance.id, activeAccount?.username ?? offlineName)}
            >
              <Download size={16} />
              Launch
            </button>
          </div>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" className="banner-dismiss" onClick={dismissError} aria-label="Dismiss error">
              ✕
            </button>
          </div>
        ) : null}
        {notice ? <div className="notice-banner">{notice}</div> : null}

        <div className="content-grid">
          <section className="main-column">
            <section className="panel" id="instances">
              <div className="panel-heading">
                <h2>Instances</h2>
                <span>{instances.length} profiles</span>
              </div>
              <form className="inline-form" onSubmit={handleCreateInstance}>
                <input aria-label="Instance name" value={instanceName} onChange={(event) => setInstanceName(event.target.value)} />
                <input aria-label="Minecraft version" value={version} onChange={(event) => setVersion(event.target.value)} />
                <select aria-label="Loader" value={loader} onChange={(event) => setLoader(event.target.value as LoaderType)}>
                  {loaderOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button className="primary-button" type="submit" disabled={busy}>
                  <Plus size={16} />
                  Create
                </button>
              </form>
              <div className="instance-grid">
                {instances.length === 0 ? (
                  <p className="empty">Create an instance to begin.</p>
                ) : (
                  instances.map((instance) => (
                    <InstanceCard
                      key={instance.id}
                      instance={instance}
                      selected={instance.id === selectedInstance?.id}
                      busy={busy}
                      maxRamMb={totalMemoryMb}
                      onSelect={() => selectInstance(instance.id)}
                      onLaunch={() => void launchOffline(instance.id, activeAccount?.username ?? offlineName)}
                      onChangeRam={(ramMb) => void updateInstance(instance.id, { ramMb })}
                      onDelete={() => void deleteInstance(instance.id)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="panel" id="mods">
              <div className="panel-heading">
                <h2>Modrinth</h2>
                <span>{selectedInstance?.loader ?? "no loader"}</span>
              </div>
              <form className="inline-form" onSubmit={handleSearch}>
                <input aria-label="Search Modrinth" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select
                  aria-label="Project type"
                  value={projectType}
                  onChange={(event) => setProjectType(event.target.value as "mod" | "shader")}
                >
                  <option value="mod">mod</option>
                  <option value="shader">shader</option>
                </select>
                <button className="secondary-button" type="submit" disabled={busy}>
                  <PackageSearch size={16} />
                  Search
                </button>
              </form>
              <div className="result-list">
                {modrinthResults.length === 0 ? (
                  <p className="empty">Search Modrinth to install mods and shaderpacks.</p>
                ) : (
                  modrinthResults.map((project) => (
                    <article className="result-row" key={project.projectId}>
                      {project.iconUrl ? (
                        <img src={project.iconUrl} alt="" />
                      ) : (
                        <div className="result-icon">
                          <PackageSearch size={18} />
                        </div>
                      )}
                      <div>
                        <h3>{project.title}</h3>
                        <p>{project.description}</p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!selectedInstance || busy}
                        onClick={() => selectedInstance && void installModrinth(project.projectId, selectedInstance.id)}
                      >
                        Install
                      </button>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>

          <aside className="side-column">
            <section className="panel" id="accounts">
              <div className="panel-heading">
                <h2>Accounts</h2>
                <span>{accounts.length}</span>
              </div>
              <form className="stack-form" onSubmit={handleOfflineAccount}>
                <input aria-label="Offline username" value={offlineName} onChange={(event) => setOfflineName(event.target.value)} />
                <button className="primary-button" type="submit" disabled={busy}>
                  <KeyRound size={16} />
                  Add Account
                </button>
              </form>
              <div className="account-list">
                {accounts.length === 0 ? (
                  <p className="empty">No accounts yet.</p>
                ) : (
                  accounts.map((account) => (
                    <div className={`account-row ${account.active ? "account-active" : ""}`} key={account.id}>
                      <button
                        type="button"
                        className="account-pick"
                        onClick={() => void setActiveAccount(account.id)}
                        disabled={busy || account.active}
                      >
                        <strong>{account.username}</strong>
                        <span>
                          {account.type}
                          {account.active ? " · active" : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Remove ${account.username}`}
                        onClick={() => void deleteAccount(account.id)}
                        disabled={busy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel" id="settings">
              <div className="panel-heading">
                <h2>Settings</h2>
                <span>{settings?.theme ?? "system"}</span>
              </div>
              <label className="field-label">
                Default memory (MB)
                <input
                  type="number"
                  min={1024}
                  max={totalMemoryMb}
                  step={512}
                  value={settings?.defaultRamMb ?? 4096}
                  onChange={(event) => void updateSettings({ defaultRamMb: Number(event.target.value) })}
                />
              </label>
              <p className="settings-hint">Detected system memory: {(totalMemoryMb / 1024).toFixed(1)} GB</p>
              <div className="java-list">
                {java.length === 0 ? (
                  <p className="empty">No Java runtimes detected. Install Temurin 8/17/21.</p>
                ) : (
                  java.map((runtime) => (
                    <div key={runtime.path} title={runtime.path}>
                      <strong>Java {runtime.major}</strong>
                      <span>{runtime.source}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <LogsPanel launches={launches} />
          </aside>
        </div>
      </section>
    </main>
  );
}
