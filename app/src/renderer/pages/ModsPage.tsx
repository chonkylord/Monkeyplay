import type { InstalledMod, InstanceProfile, ModrinthProject, PresetModStatus } from "@shared/types";
import { Check, Download, Gauge, MonitorCheck, PackageSearch, Trash2, X, Zap } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

interface ModsPageProps {
  instances: InstanceProfile[];
  selectedInstance?: InstanceProfile;
  mods: InstalledMod[];
  modrinthResults: ModrinthProject[];
  presetStatuses?: PresetModStatus[];
  busy: boolean;
  onSelectInstance: (id: string) => void;
  onLoadMods: (instanceId: string) => void;
  onToggleMod: (instanceId: string, fileName: string, enabled: boolean) => void;
  onDeleteMod: (instanceId: string, fileName: string) => void;
  onInstallFpsBoost: (instanceId: string) => void;
  onInstallCompanion: (instanceId: string) => void;
  onSearch: (query: string, projectType: "mod" | "shader") => void;
  onInstall: (projectId: string, instanceId: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ModsPage({
  instances,
  selectedInstance,
  mods,
  modrinthResults,
  presetStatuses,
  busy,
  onSelectInstance,
  onLoadMods,
  onToggleMod,
  onDeleteMod,
  onInstallFpsBoost,
  onInstallCompanion,
  onSearch,
  onInstall
}: ModsPageProps) {
  const [search, setSearch] = useState("sodium");
  const [projectType, setProjectType] = useState<"mod" | "shader">("mod");
  const instanceId = selectedInstance?.id;
  const moddable = selectedInstance && (selectedInstance.loader === "fabric" || selectedInstance.loader === "quilt");

  useEffect(() => {
    if (instanceId) {
      onLoadMods(instanceId);
    }
  }, [instanceId, onLoadMods]);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSearch(search, projectType);
  }

  return (
    <div className="page" id="mods">
      <div className="page-head">
        <h1>Mods</h1>
        <div className="instance-picker">
          <span>Instance</span>
          <select
            aria-label="Mods instance"
            value={instanceId ?? ""}
            onChange={(event) => onSelectInstance(event.target.value)}
          >
            {instances.length === 0 ? <option value="">No instances</option> : null}
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.name} · {instance.minecraftVersion} ({instance.loader})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!moddable && selectedInstance ? (
        <p className="hint-banner">
          Mods need a Fabric or Quilt instance — “{selectedInstance.name}” uses {selectedInstance.loader}.
        </p>
      ) : null}

      <div className="feature-cards">
        <article className="feature-card" id="fps-boost">
          <div className="feature-icon">
            <Zap size={22} />
          </div>
          <div className="feature-body">
            <h3>Performance Pack</h3>
            <p>Sodium, Lithium, Iris shaders + 6 more optimization mods. The Lunar-style FPS boost, one click.</p>
            {presetStatuses ? (
              <ul className="preset-status">
                {presetStatuses.map((status) => (
                  <li key={status.slug} className={status.status === "installed" ? "ok" : "skip"} title={status.detail}>
                    {status.status === "installed" ? <Check size={13} /> : <X size={13} />}
                    {status.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={!moddable || busy}
            onClick={() => instanceId && onInstallFpsBoost(instanceId)}
          >
            <Gauge size={15} />
            Install pack
          </button>
        </article>

        <article className="feature-card" id="hud">
          <div className="feature-icon feature-icon-alt">
            <MonitorCheck size={22} />
          </div>
          <div className="feature-body">
            <h3>MonkeyPlay HUD</h3>
            <p>FPS, CPS, ping, coordinates and keystrokes overlay in-game. Fair-play only — vanilla-equivalent info.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={!moddable || busy}
            onClick={() => instanceId && onInstallCompanion(instanceId)}
          >
            <Download size={15} />
            Install HUD
          </button>
        </article>
      </div>

      <div className="mods-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Browse Modrinth</h2>
            <span>{selectedInstance ? `${selectedInstance.minecraftVersion} · ${selectedInstance.loader}` : ""}</span>
          </div>
          <form className="inline-form" onSubmit={handleSearch}>
            <input aria-label="Search Modrinth" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select
              aria-label="Project type"
              value={projectType}
              onChange={(event) => setProjectType(event.target.value as "mod" | "shader")}
            >
              <option value="mod">Mods</option>
              <option value="shader">Shaders</option>
            </select>
            <button className="secondary-button" type="submit" disabled={busy}>
              <PackageSearch size={15} />
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
                    <img src={project.iconUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="result-icon">
                      <PackageSearch size={17} />
                    </div>
                  )}
                  <div>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!instanceId || busy}
                    onClick={() => instanceId && onInstall(project.projectId, instanceId)}
                  >
                    Install
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel" id="installed">
          <div className="panel-heading">
            <h2>Installed</h2>
            <span>{mods.length} files</span>
          </div>
          <div className="mod-list">
            {mods.length === 0 ? (
              <p className="empty">No mods installed in this instance yet.</p>
            ) : (
              mods.map((mod) => (
                <div className="mod-row" key={mod.fileName}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      aria-label={`Toggle ${mod.fileName}`}
                      onChange={(event) => instanceId && onToggleMod(instanceId, mod.fileName, event.target.checked)}
                    />
                    <span className="switch-track" />
                  </label>
                  <div className="mod-meta">
                    <strong className={mod.enabled ? "" : "mod-disabled"}>{mod.fileName}</strong>
                    <small>{formatSize(mod.sizeBytes)}</small>
                  </div>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`Delete ${mod.fileName}`}
                    onClick={() => instanceId && onDeleteMod(instanceId, mod.fileName)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
