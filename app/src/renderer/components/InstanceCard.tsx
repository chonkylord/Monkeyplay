import type { InstanceProfile } from "@shared/types";
import { Cpu, FolderOpen, Gauge, Globe, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ServerSpecs } from "./ServerSpecs";

interface InstanceCardProps {
  instance: InstanceProfile;
  selected: boolean;
  busy: boolean;
  maxRamMb: number;
  onSelect: () => void;
  onLaunch: () => void;
  onChangeRam: (ramMb: number) => void;
  onChangeServer: (serverAddress: string) => void;
  onDelete: () => void;
  onOpenFolder: () => void;
}

export function InstanceCard({
  instance,
  selected,
  busy,
  maxRamMb,
  onSelect,
  onLaunch,
  onChangeRam,
  onChangeServer,
  onDelete,
  onOpenFolder
}: InstanceCardProps) {
  const [ram, setRam] = useState(instance.ramMb);
  const [server, setServer] = useState(instance.serverAddress ?? "");

  // Keep the local inputs in sync when persisted values change underneath us.
  useEffect(() => setRam(instance.ramMb), [instance.ramMb]);
  useEffect(() => setServer(instance.serverAddress ?? ""), [instance.serverAddress]);

  function commitRam(): void {
    if (ram !== instance.ramMb) {
      onChangeRam(ram);
    }
  }

  function commitServer(): void {
    if (server.trim() !== (instance.serverAddress ?? "")) {
      onChangeServer(server.trim());
    }
  }

  return (
    <article className={`instance-card ${selected ? "instance-card-selected" : ""}`} onClick={onSelect}>
      <div className="instance-card-head">
        <div>
          <h3>{instance.name}</h3>
          <p>
            {instance.minecraftVersion} · {instance.loader}
          </p>
        </div>
        <div className="instance-card-actions">
          <button
            className="icon-button"
            type="button"
            aria-label={`Open folder for ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenFolder();
            }}
          >
            <FolderOpen size={15} />
          </button>
          <button
            className="icon-button danger"
            type="button"
            aria-label={`Delete ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            disabled={busy}
          >
            <Trash2 size={15} />
          </button>
          <button
            className="icon-button accent"
            type="button"
            aria-label={`Launch ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onLaunch();
            }}
            disabled={busy}
          >
            <Play size={16} />
          </button>
        </div>
      </div>

      <label className="ram-control" onClick={(event) => event.stopPropagation()}>
        <span className="ram-label">
          <Gauge size={13} />
          Memory
          <strong>{(ram / 1024).toFixed(1)} GB</strong>
        </span>
        <input
          type="range"
          min={1024}
          max={Math.max(maxRamMb, instance.ramMb)}
          step={512}
          value={ram}
          aria-label={`Memory for ${instance.name}`}
          onChange={(event) => setRam(Number(event.target.value))}
          onPointerUp={commitRam}
          onBlur={commitRam}
        />
      </label>

      <label className="server-control" onClick={(event) => event.stopPropagation()}>
        <Globe size={13} />
        <input
          aria-label={`Default server for ${instance.name}`}
          placeholder="Auto-join server (optional)"
          value={server}
          onChange={(event) => setServer(event.target.value)}
          onBlur={commitServer}
        />
      </label>
      {instance.serverAddress?.trim() ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ServerSpecs address={instance.serverAddress} compact />
        </div>
      ) : server.trim() && server.trim() !== instance.serverAddress ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ServerSpecs address={server} compact />
        </div>
      ) : null}

      <div className="metric-row">
        <span>
          <Cpu size={13} />
          Java {instance.javaMajor ?? "auto"}
        </span>
        <span>{instance.jvmArgs.length} JVM args</span>
      </div>
    </article>
  );
}
