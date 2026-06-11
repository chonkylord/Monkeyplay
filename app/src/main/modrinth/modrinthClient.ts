import type { InstanceProfile, LoaderType, ModrinthProject } from "@shared/types";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getSettings } from "../settings/settingsService";

interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  project_type: ModrinthProject["projectType"];
  downloads: number;
  icon_url?: string;
  author?: string;
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  dependencies: Array<{
    project_id?: string;
    version_id?: string;
    dependency_type: "required" | "optional" | "incompatible" | "embedded";
  }>;
  files: Array<{
    url: string;
    filename: string;
    primary: boolean;
    hashes: {
      sha1?: string;
    };
  }>;
}

function loaderFacet(loader: LoaderType): string | undefined {
  if (loader === "vanilla") {
    return undefined;
  }
  return loader;
}

async function modrinthFetch<T>(path: string): Promise<T> {
  const settings = await getSettings();
  const response = await fetch(`https://api.modrinth.com/v2${path}`, {
    headers: {
      "User-Agent": settings.modrinthUserAgent
    }
  });
  if (!response.ok) {
    throw new Error(`Modrinth request failed (${response.status}) for ${path}`);
  }
  return (await response.json()) as T;
}

export async function searchProjects(query: string, projectType: "mod" | "shader" = "mod"): Promise<ModrinthProject[]> {
  const facets = encodeURIComponent(JSON.stringify([["project_type", projectType]]));
  const result = await modrinthFetch<{ hits: ModrinthSearchHit[] }>(
    `/search?query=${encodeURIComponent(query)}&limit=20&facets=${facets}`
  );
  return result.hits.map((hit) => ({
    projectId: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    description: hit.description,
    projectType: hit.project_type,
    downloads: hit.downloads,
    iconUrl: hit.icon_url,
    author: hit.author
  }));
}

export async function findInstallableVersion(projectId: string, instance: InstanceProfile): Promise<ModrinthVersion> {
  const loaders = loaderFacet(instance.loader);
  const params = new URLSearchParams({
    game_versions: JSON.stringify([instance.minecraftVersion])
  });
  if (loaders) {
    params.set("loaders", JSON.stringify([loaders]));
  }
  const versions = await modrinthFetch<ModrinthVersion[]>(`/project/${projectId}/version?${params.toString()}`);
  const version = versions.find((item) => item.files.some((file) => file.primary)) ?? versions[0];
  if (!version) {
    throw new Error(`No compatible Modrinth version found for ${projectId}.`);
  }
  return version;
}

async function downloadModFile(version: ModrinthVersion, instance: InstanceProfile): Promise<string> {
  const primary = version.files.find((file) => file.primary) ?? version.files[0];
  if (!primary) {
    throw new Error(`Modrinth version ${version.id} has no downloadable files.`);
  }
  const modsDir = join(instance.gameDir, "mods");
  await mkdir(modsDir, { recursive: true });
  const targetPath = join(modsDir, primary.filename);
  const response = await fetch(primary.url, {
    headers: {
      "User-Agent": (await getSettings()).modrinthUserAgent
    }
  });
  if (!response.ok || !response.body) {
    throw new Error(`Mod download failed (${response.status}) for ${primary.filename}`);
  }
  await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>), createWriteStream(targetPath));
  return targetPath;
}

export async function installProject(projectId: string, instance: InstanceProfile): Promise<string[]> {
  const installed: string[] = [];
  const queue = [await findInstallableVersion(projectId, instance)];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const version = queue.shift();
    if (!version || seen.has(version.project_id)) {
      continue;
    }
    seen.add(version.project_id);
    installed.push(await downloadModFile(version, instance));

    for (const dependency of version.dependencies) {
      if (dependency.dependency_type === "required" && dependency.project_id && !seen.has(dependency.project_id)) {
        queue.push(await findInstallableVersion(dependency.project_id, instance));
      }
    }
  }

  return installed;
}
