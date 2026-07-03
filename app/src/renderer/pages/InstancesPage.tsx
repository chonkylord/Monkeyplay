import type { CreateInstanceInput, InstanceProfile, LoaderType, VersionSummary } from "@shared/types";
import { Plus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { InstanceCard } from "../components/InstanceCard";

interface InstancesPageProps {
  instances: InstanceProfile[];
  versions: VersionSummary[];
  selectedInstanceId?: string;
  busy: boolean;
  launchBusy: boolean;
  maxRamMb: number;
  onCreate: (input: CreateInstanceInput) => void;
  onSelect: (id: string) => void;
  onLaunch: (id: string) => void;
  onUpdate: (id: string, update: Partial<CreateInstanceInput>) => void;
  onDelete: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

const loaderOptions: LoaderType[] = ["fabric", "vanilla", "quilt", "forge", "neoforge"];

export function InstancesPage({
  instances,
  versions,
  selectedInstanceId,
  busy,
  launchBusy,
  maxRamMb,
  onCreate,
  onSelect,
  onLaunch,
  onUpdate,
  onDelete,
  onOpenFolder
}: InstancesPageProps) {
  const [name, setName] = useState("New Instance");
  const [loader, setLoader] = useState<LoaderType>("fabric");
  const [showSnapshots, setShowSnapshots] = useState(false);
  const releases = useMemo(
    () => versions.filter((version) => (showSnapshots ? true : version.type === "release")),
    [versions, showSnapshots]
  );
  const [version, setVersion] = useState("");
  const effectiveVersion = version || releases[0]?.id || "1.21.4";

  function handleCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onCreate({ name, minecraftVersion: effectiveVersion, loader });
  }

  return (
    <div className="page" id="instances">
      <div className="page-head">
        <h1>Instances</h1>
        <span className="page-sub">{instances.length} profiles</span>
      </div>

      <form className="create-bar" onSubmit={handleCreate}>
        <input aria-label="Instance name" value={name} onChange={(event) => setName(event.target.value)} />
        {releases.length > 0 ? (
          <select aria-label="Minecraft version" value={effectiveVersion} onChange={(event) => setVersion(event.target.value)}>
            {releases.slice(0, 200).map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
                {item.type !== "release" ? ` (${item.type})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            aria-label="Minecraft version"
            value={version || "1.21.4"}
            onChange={(event) => setVersion(event.target.value)}
          />
        )}
        <select aria-label="Loader" value={loader} onChange={(event) => setLoader(event.target.value as LoaderType)}>
          {loaderOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label className="snapshot-toggle">
          <input type="checkbox" checked={showSnapshots} onChange={(event) => setShowSnapshots(event.target.checked)} />
          Snapshots
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          <Plus size={16} />
          Create
        </button>
      </form>

      <div className="instance-grid">
        {instances.length === 0 ? (
          <p className="empty">Create an instance to begin. Fabric + the performance pack is the recommended setup.</p>
        ) : (
          instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              selected={instance.id === selectedInstanceId}
              busy={busy || launchBusy}
              maxRamMb={maxRamMb}
              onSelect={() => onSelect(instance.id)}
              onLaunch={() => onLaunch(instance.id)}
              onChangeRam={(ramMb) => onUpdate(instance.id, { ramMb })}
              onChangeServer={(serverAddress) => onUpdate(instance.id, { serverAddress })}
              onDelete={() => onDelete(instance.id)}
              onOpenFolder={() => onOpenFolder(instance.gameDir)}
            />
          ))
        )}
      </div>
    </div>
  );
}
