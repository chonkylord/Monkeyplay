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

export async function getVersionManifest(): Promise<VersionManifest> {
  return fetchJson<VersionManifest>(manifestUrl);
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

export async function downloadLibraries(version: VersionJson): Promise<{ classpath: string[]; nativesDir: string }> {
  const classpath: string[] = [];
  const nativesDir = join(sharedRoot(), "natives", version.id, process.platform);
  await mkdir(nativesDir, { recursive: true });

  for (const library of version.libraries) {
    if (!rulesAllow(library.rules)) {
      continue;
    }
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
  }

  return { classpath, nativesDir };
}

export async function downloadAssets(version: VersionJson): Promise<string> {
  const indexPath = join(sharedRoot(), "assets", "indexes", `${version.assetIndex.id}.json`);
  await downloadFile(version.assetIndex.url, indexPath, version.assetIndex.sha1);
  const assetIndex = await fetchJson<AssetIndex>(version.assetIndex.url);

  for (const asset of Object.values(assetIndex.objects)) {
    const prefix = asset.hash.slice(0, 2);
    const objectPath = join(sharedRoot(), "assets", "objects", prefix, asset.hash);
    await downloadFile(`https://resources.download.minecraft.net/${prefix}/${asset.hash}`, objectPath, asset.hash);
  }

  return basename(indexPath, ".json");
}

