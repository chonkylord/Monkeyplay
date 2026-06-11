import type { InstanceProfile } from "@shared/types";
import { Cpu, Gauge, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface InstanceCardProps {
  instance: InstanceProfile;
  selected: boolean;
  busy: boolean;
  maxRamMb: number;
  onSelect: () => void;
  onLaunch: () => void;
  onChangeRam: (ramMb: number) => void;
  onDelete: () => void;
}

export function InstanceCard({ instance, selected, busy, maxRamMb, onSelect, onLaunch, onChangeRam, onDelete }: InstanceCardProps) {
  const [ram, setRam] = useState(instance.ramMb);

  // Keep the slider in sync when the persisted value changes underneath us.
  useEffect(() => setRam(instance.ramMb), [instance.ramMb]);

  function commitRam(): void {
    if (ram !== instance.ramMb) {
      onChangeRam(ram);
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
            className="icon-button danger"
            type="button"
            aria-label={`Delete ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            disabled={busy}
          >
            <Trash2 size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={`Launch ${instance.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onLaunch();
            }}
            disabled={busy}
          >
            <Play size={18} />
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

      <div className="metric-row">
        <span>
          <Cpu size={14} />
          Java {instance.javaMajor ?? "auto"}
        </span>
        <span>{instance.jvmArgs.length} JVM args</span>
      </div>
    </article>
  );
}
