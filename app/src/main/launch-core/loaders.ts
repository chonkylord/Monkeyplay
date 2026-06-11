import type { LoaderType } from "@shared/types";
import type { Library, VersionJson } from "./mojang";

/**
 * Loader profiles (Fabric/Quilt) follow Mojang's "launcher meta" shape: an
 * `inheritsFrom` base, a replacement `mainClass`, extra Maven libraries, and
 * additional JVM/game arguments. We fetch that profile and merge it onto the
 * resolved vanilla {@link VersionJson} so the existing download + argument
 * pipeline can launch the modded game unchanged.
 */
interface LoaderProfile {
  mainClass: string;
  libraries?: Array<{ name: string; url?: string; sha1?: string }>;
  arguments?: {
    jvm?: string[];
    game?: string[];
  };
}

interface LoaderMetaEntry {
  loader: { version: string; stable?: boolean };
}

const loaderMeta: Record<"fabric" | "quilt", { listUrl: (mc: string) => string; profileUrl: (mc: string, loader: string) => string; defaultRepo: string }> = {
  fabric: {
    listUrl: (mc) => `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}`,
    profileUrl: (mc, loader) =>
      `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader)}/profile/json`,
    defaultRepo: "https://maven.fabricmc.net/"
  },
  quilt: {
    listUrl: (mc) => `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}`,
    profileUrl: (mc, loader) =>
      `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader)}/profile/json`,
    defaultRepo: "https://maven.quiltmc.org/repository/release/"
  }
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "ChunkyPlay/0.1.0" } });
  if (!response.ok) {
    throw new Error(`Loader metadata request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

/** Convert a `group:artifact:version[:classifier]` Maven coordinate into its repository path. */
export function mavenNameToPath(name: string): string {
  const [coordinate, ...rest] = name.split("@");
  const parts = coordinate.split(":");
  const [group, artifact, version, classifier] = parts;
  const extension = rest[0] ?? "jar";
  const file = `${artifact}-${version}${classifier ? `-${classifier}` : ""}.${extension}`;
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${file}`;
}

function toLibrary(entry: { name: string; url?: string; sha1?: string }, defaultRepo: string): Library {
  const repo = entry.url && entry.url.length > 0 ? entry.url : defaultRepo;
  const path = mavenNameToPath(entry.name);
  return {
    name: entry.name,
    downloads: {
      artifact: {
        path,
        sha1: entry.sha1,
        url: `${repo.endsWith("/") ? repo : `${repo}/`}${path}`
      }
    }
  };
}

async function resolveLoaderVersion(loader: "fabric" | "quilt", minecraftVersion: string, pinned?: string): Promise<string> {
  if (pinned) {
    return pinned;
  }
  const meta = loaderMeta[loader];
  const entries = await fetchJson<LoaderMetaEntry[]>(meta.listUrl(minecraftVersion));
  if (entries.length === 0) {
    throw new Error(`${loader} has no builds for Minecraft ${minecraftVersion}.`);
  }
  const stable = entries.find((entry) => entry.loader.stable);
  return (stable ?? entries[0]).loader.version;
}

/**
 * Merge the resolved loader profile onto the vanilla version. The returned
 * VersionJson keeps every vanilla library/asset and adds the loader's main
 * class, libraries, and arguments. Returns the chosen loader version too so the
 * caller can record/log it.
 */
export async function applyLoader(
  version: VersionJson,
  loader: LoaderType,
  minecraftVersion: string,
  pinnedLoaderVersion?: string
): Promise<{ version: VersionJson; loaderVersion?: string }> {
  if (loader === "vanilla") {
    return { version };
  }

  if (loader === "forge" || loader === "neoforge") {
    throw new Error(
      `${loader === "forge" ? "Forge" : "NeoForge"} instances are not yet auto-installed by ChunkyPlay. ` +
        `Install the ${loader} client profile for Minecraft ${minecraftVersion} with the official installer, ` +
        `or use a Fabric/Quilt instance for Modrinth mods.`
    );
  }

  const meta = loaderMeta[loader];
  const loaderVersion = await resolveLoaderVersion(loader, minecraftVersion, pinnedLoaderVersion);
  const profile = await fetchJson<LoaderProfile>(meta.profileUrl(minecraftVersion, loaderVersion));

  const loaderLibraries = (profile.libraries ?? []).map((entry) => toLibrary(entry, meta.defaultRepo));

  const merged: VersionJson = {
    ...version,
    mainClass: profile.mainClass,
    libraries: [...loaderLibraries, ...version.libraries],
    arguments: {
      jvm: [...(version.arguments?.jvm ?? []), ...(profile.arguments?.jvm ?? [])],
      game: [...(version.arguments?.game ?? []), ...(profile.arguments?.game ?? [])]
    }
  };

  return { version: merged, loaderVersion };
}
