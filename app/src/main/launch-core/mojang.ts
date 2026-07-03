import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { sharedRoot } from "../paths";
import { downloadFile } from "./download";
import { rulesAllow, type Rule } from "./rules";

// extract-zip is CommonJS; loading it through createRequire avoids Node's
// ESM→CJS preparse crash when the bundled main is executed directly.
const require = createRequire(import.meta.url);
const extract = require("extract-zip") as (zipPath: string, opts: { dir: string }) => Promise<void>;

const manifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<{
    id: string;
    type: string;
    url: string;
    sha1: string;
    releaseTime?: string;
  }>;
}

export interface Artifact {
  path?: string;
  sha1?: string;
  size?: number;
  url: string;
}

export interface Library {
  name: string;
  rules?: Rule[];
  downloads?: {
    artifact?: Artifact;
    classifiers?: Record<string, Artifact>;
  };
  natives?: Record<string, string>;
}

type ArgumentPart = string | { rules?: Rule[]; value: string | string[] };

export interface VersionJson {
  id: string;
  mainClass: string;
  assetIndex: {
    id: string;
    url: string;
    sha1: string;
  };
  assets?: string;
  downloads: {
    client: Artifact;
  };
  libraries: Library[];
  arguments?: {
    game?: ArgumentPart[];
    jvm?: ArgumentPart[];
  };
  minecraftArguments?: string;
}

export interface AssetIndex {
  objects: Record<string, { hash: string; size: number }>;
}

function osClassifierKey(): string {
  if (process.platform === "win32") {
    return "natives-windows";
  }
  if (process.platform === "darwin") {
    return "natives-macos";
  }
  return "natives-linux";
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MonkeyPlay/0.1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

let manifestCache: { manifest: VersionManifest; fetchedAt: number } | undefined;

export async function getVersionManifest(): Promise<VersionManifest> {
  // The manifest is fetched on every version-picker open and every launch;
  // cache it briefly so the UI stays snappy and Mojang isn't hammered.
  if (manifestCache && Date.now() - manifestCache.fetchedAt < 5 * 60_000) {
    return manifestCache.manifest;
  }
  const manifest = await fetchJson<VersionManifest>(manifestUrl);
  manifestCache = { manifest, fetchedAt: Date.now() };
  return manifest;
}

export async function listVersions(): Promise<Array<{ id: string; type: string; releaseTime: string }>> {
  const manifest = await getVersionManifest();
  return manifest.versions.map((version) => ({
    id: version.id,
    type: version.type,
    releaseTime: (version as { releaseTime?: string }).releaseTime ?? ""
  }));
}

export async function resolveVersion(versionId: string): Promise<VersionJson> {
  const manifest = await getVersionManifest();
  const entry = manifest.versions.find((version) => version.id === versionId);
  if (!entry) {
    throw new Error(`Minecraft version not found: ${versionId}`);
  }
  const targetPath = join(sharedRoot(), "versions", versionId, `${versionId}.json`);
  await downloadFile(entry.url, targetPath, entry.sha1);
  return fetchJson<VersionJson>(entry.url);
}

export async function downloadClientJar(version: VersionJson): Promise<string> {
  const targetPath = join(sharedRoot(), "versions", version.id, `${version.id}.jar`);
  await downloadFile(version.downloads.client.url, targetPath, version.downloads.client.sha1);
  return targetPath;
}

export async function downloadLibraries(
  version: VersionJson,
  onProgress?: (done: number, total: number) => void
): Promise<{ classpath: string[]; nativesDir: string }> {
  const classpath: string[] = [];
  const nativesDir = join(sharedRoot(), "natives", version.id, process.platform);
  await mkdir(nativesDir, { recursive: true });

  const allowed = version.libraries.filter((library) => rulesAllow(library.rules));
  let done = 0;
  onProgress?.(0, allowed.length);

  for (const library of allowed) {
    const artifact = library.downloads?.artifact;
    if (artifact?.path) {
      const targetPath = join(sharedRoot(), "libraries", artifact.path);
      await downloadFile(artifact.url, targetPath, artifact.sha1);
      classpath.push(targetPath);
    }
    const nativeKey = library.natives?.[process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux"] ?? osClassifierKey();
    const nativeArtifact = library.downloads?.classifiers?.[nativeKey];
    if (nativeArtifact?.path) {
      const nativePath = join(sharedRoot(), "libraries", nativeArtifact.path);
      await downloadFile(nativeArtifact.url, nativePath, nativeArtifact.sha1);
      await extract(nativePath, { dir: nativesDir });
    }
    done += 1;
    if (done % 10 === 0 || done === allowed.length) {
      onProgress?.(done, allowed.length);
    }
  }

  return { classpath, nativesDir };
}

/** Run an async task over items with a bounded number of concurrent workers. */
async function mapWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}

export async function downloadAssets(
  version: VersionJson,
  onProgress?: (done: number, total: number) => void,
  concurrency = 12
): Promise<string> {
  const indexPath = join(sharedRoot(), "assets", "indexes", `${version.assetIndex.id}.json`);
  await downloadFile(version.assetIndex.url, indexPath, version.assetIndex.sha1);
  const assetIndex = await fetchJson<AssetIndex>(version.assetIndex.url);

  const objects = Object.values(assetIndex.objects);
  const total = objects.length;
  let done = 0;
  onProgress?.(0, total);

  // Thousands of small files: download in parallel and report progress so the
  // UI shows movement instead of appearing frozen on a fresh install.
  await mapWithConcurrency(objects, concurrency, async (asset) => {
    const prefix = asset.hash.slice(0, 2);
    const objectPath = join(sharedRoot(), "assets", "objects", prefix, asset.hash);
    await downloadFile(`https://resources.download.minecraft.net/${prefix}/${asset.hash}`, objectPath, asset.hash);
    done += 1;
    if (done % 25 === 0 || done === total) {
      onProgress?.(done, total);
    }
  });

  return basename(indexPath, ".json");
}

