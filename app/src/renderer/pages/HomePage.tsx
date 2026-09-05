import type { InstanceProfile, NewsItem } from "@shared/types";
import { ChevronDown, Globe, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import type { LaunchState } from "../store/useLauncherStore";
import { ServerSpecs } from "../components/ServerSpecs";

interface HomePageProps {
  instances: InstanceProfile[];
  selectedInstance?: InstanceProfile;
  launchState: LaunchState;
  news: NewsItem[];
  username?: string;
  onSelectInstance: (id: string) => void;
  onLaunch: (instanceId: string, serverAddress?: string) => void;
  onOpenNews: () => void;
}

function phaseLabel(state: LaunchState): string {
  if (!state.phase) {
    return state.message ?? "";
  }
  const labels: Record<string, string> = {
    queued: "Preparing…",
    "resolving-version": "Resolving version…",
    "downloading-client": "Downloading client…",
    "downloading-libraries": "Downloading libraries…",
    "downloading-assets": "Downloading assets…",
    "provisioning-java": "Preparing Java…",
    "building-command": "Almost ready…",
    running: "Game running",
    exited: "Game closed",
    failed: "Launch failed"
  };
  return labels[state.phase] ?? state.phase;
}

export function HomePage({
  instances,
  selectedInstance,
  launchState,
  news,
  username,
  onSelectInstance,
  onLaunch,
  onOpenNews
}: HomePageProps) {
  const [server, setServer] = useState("");
  const launching = launchState.active && launchState.phase !== "running";

  return (
    <div className="page home-page">
      <section className="hero" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <p className="hero-greeting">{username ? `Welcome back, ${username}` : "Welcome to MonkeyPlay"}</p>
        <h1>Jump into Minecraft</h1>

        <div className="hero-launch">
          <div className="version-select">
            <select
              aria-label="Instance to launch"
              value={selectedInstance?.id ?? ""}
              onChange={(event) => onSelectInstance(event.target.value)}
              disabled={instances.length === 0 || launching}
            >
              {instances.length === 0 ? <option value="">No instances yet</option> : null}
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} · {instance.minecraftVersion} {instance.loader !== "vanilla" ? `(${instance.loader})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>

          <button
            type="button"
            className="launch-button"
            id="launch"
            disabled={!selectedInstance || launching}
            onClick={() => selectedInstance && onLaunch(selectedInstance.id, server.trim() || undefined)}
          >
            {launching ? <RotateCw className="spin" size={22} /> : <Play size={22} />}
            <span>
              {launching ? "LAUNCHING…" : launchState.phase === "running" ? "RUNNING" : "LAUNCH"}
              {selectedInstance ? <small>{selectedInstance.minecraftVersion}</small> : null}
            </span>
          </button>
        </div>

        <label className="quick-join">
          <Globe size={15} />
          <input
            aria-label="Quick join server"
            placeholder="Quick join a server (optional) — e.g. hypixel.net"
            value={server}
            onChange={(event) => setServer(event.target.value)}
            disabled={launching}
          />
        </label>
        {server.trim() ? <ServerSpecs address={server} /> : null}

        {launchState.phase || launchState.message ? (
          <div className={`launch-status ${launchState.failed ? "launch-status-failed" : ""}`}>
            <div className="launch-status-row">
              <span>{phaseLabel(launchState)}</span>
              {launchState.progressPct !== undefined && launchState.active ? <span>{launchState.progressPct}%</span> : null}
            </div>
            {launchState.active ? (
              <div className="progress-track">
                <div
                  className={`progress-fill ${launchState.progressPct === undefined ? "progress-indeterminate" : ""}`}
                  style={launchState.progressPct !== undefined ? { width: `${launchState.progressPct}%` } : undefined}
                />
              </div>
            ) : null}
            {launchState.message && launchState.failed ? <p className="launch-detail">{launchState.message}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="news-strip">
        <div className="strip-head">
          <h2>Latest updates</h2>
          <button type="button" className="link-button" onClick={onOpenNews}>
            View all
          </button>
        </div>
        <div className="news-cards">
          {news.length === 0 ? (
            <p className="empty">News unavailable offline.</p>
          ) : (
            news.slice(0, 4).map((item) => (
              <article className="news-card" key={item.id}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <div className="news-card-fallback" />}
                <div className="news-card-body">
                  <span className={`badge badge-${item.category === "release" ? "release" : "snapshot"}`}>{item.category}</span>
                  <h3>{item.title}</h3>
                  <time>{new Date(item.date).toLocaleDateString()}</time>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
