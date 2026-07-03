import type { LauncherSettings, RuntimeInfo, LaunchEvent } from "@shared/types";
import { ShieldCheck } from "lucide-react";
import { LogsPanel } from "../components/LogsPanel";

interface SettingsPageProps {
  settings?: LauncherSettings;
  java: RuntimeInfo[];
  launches: LaunchEvent[];
  totalMemoryMb: number;
  onUpdateSettings: (update: Partial<LauncherSettings>) => void;
}

export function SettingsPage({ settings, java, launches, totalMemoryMb, onUpdateSettings }: SettingsPageProps) {
  return (
    <div className="page" id="settings">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="settings-columns">
        <div className="settings-stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Game defaults</h2>
            </div>
            <label className="field-label">
              Default memory for new instances
              <div className="field-inline">
                <input
                  type="range"
                  min={1024}
                  max={totalMemoryMb}
                  step={512}
                  value={settings?.defaultRamMb ?? 4096}
                  aria-label="Default memory"
                  onChange={(event) => onUpdateSettings({ defaultRamMb: Number(event.target.value) })}
                />
                <strong>{((settings?.defaultRamMb ?? 4096) / 1024).toFixed(1)} GB</strong>
              </div>
            </label>
            <p className="settings-hint">Detected system memory: {(totalMemoryMb / 1024).toFixed(1)} GB</p>
            <label className="field-label">
              Default JVM arguments
              <input
                aria-label="Default JVM arguments"
                value={(settings?.defaultJvmArgs ?? []).join(" ")}
                onChange={(event) =>
                  onUpdateSettings({ defaultJvmArgs: event.target.value.split(/\s+/).filter(Boolean) })
                }
              />
            </label>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Java runtimes</h2>
              <span>{java.length} detected</span>
            </div>
            <div className="java-list">
              {java.length === 0 ? (
                <p className="empty">No Java detected — MonkeyPlay downloads Temurin automatically on first launch.</p>
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

          <section className="panel boundary-panel">
            <div className="panel-heading">
              <h2>Fair play</h2>
              <ShieldCheck size={16} />
            </div>
            <p className="settings-hint">
              MonkeyPlay ships no aim assist, X-ray, ESP, reach or velocity changes, packet manipulation, or anticheat
              evasion. The HUD shows only vanilla-visible local state, and hitboxes use Minecraft's own F3+B renderer.
            </p>
          </section>
        </div>

        <LogsPanel launches={launches} />
      </div>
    </div>
  );
}
