import type { InstalledMod, InstanceProfile, PresetModStatus } from "@shared/types";
import { app } from "electron";
import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { installProject } from "../modrinth/modrinthClient";

const DISABLED_SUFFIX = ".disabled";

/**
 * The curated performance pack: the community-standard Fabric optimization
 * stack (the same family of mods "FPS boost" clients build on). Sodium/Iris
 * also give shaderpack support. All are quality-of-life/performance only —
 * no gameplay-altering modules.
 */
export const FPS_BOOST_MODS: Array<{ slug: string; name: string }> = [
  { slug: "sodium", name: "Sodium (rendering engine)" },
  { slug: "lithium", name: "Lithium (game logic)" },
  { slug: "ferrite-core", name: "FerriteCore (memory)" },
  { slug: "entityculling", name: "Entity Culling" },
  { slug: "immediatelyfast", name: "ImmediatelyFast (UI rendering)" },
  { slug: "krypton", name: "Krypton (networking)" },
  { slug: "dynamic-fps", name: "Dynamic FPS (background)" },
  { slug: "modernfix", name: "ModernFix (startup & memory)" },
  { slug: "iris", name: "Iris Shaders" }
];

function modsDir(instance: InstanceProfile): string {
  return join(instance.gameDir, "mods");
}

export async function listMods(instance: InstanceProfile): Promise<InstalledMod[]> {
  await mkdir(modsDir(instance), { recursive: true });
  const entries = await readdir(modsDir(instance));
  const mods: InstalledMod[] = [];
  for (const entry of entries) {
    const enabled = entry.endsWith(".jar");
    if (!enabled && !entry.endsWith(`.jar${DISABLED_SUFFIX}`)) {
      continue;
    }
    const info = await stat(join(modsDir(instance), entry));
    mods.push({
      fileName: enabled ? entry : entry.slice(0, -DISABLED_SUFFIX.length),
      enabled,
      sizeBytes: info.size
    });
  }
  return mods.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/** Toggling renames `x.jar` ↔ `x.jar.disabled` so the loader skips the file. */
export async function setModEnabled(instance: InstanceProfile, fileName: string, enabled: boolean): Promise<void> {
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new Error(`Invalid mod file name: ${fileName}`);
  }
  const enabledPath = join(modsDir(instance), fileName);
  const disabledPath = `${enabledPath}${DISABLED_SUFFIX}`;
  if (enabled) {
    await rename(disabledPath, enabledPath);
  } else {
    await rename(enabledPath, disabledPath);
  }
}

export async function deleteMod(instance: InstanceProfile, fileName: string): Promise<void> {
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new Error(`Invalid mod file name: ${fileName}`);
  }
  const enabledPath = join(modsDir(instance), fileName);
  await rm(enabledPath, { force: true });
  await rm(`${enabledPath}${DISABLED_SUFFIX}`, { force: true });
}

function assertModLoader(instance: InstanceProfile): void {
  if (instance.loader !== "fabric" && instance.loader !== "quilt") {
    throw new Error(
      `The performance pack needs a Fabric or Quilt instance; "${instance.name}" uses ${instance.loader}. ` +
        `Create a Fabric instance to use it.`
    );
  }
}

/**
 * Install the curated performance pack. Individual mods that have no build
 * for the instance's Minecraft version are skipped and reported, not fatal —
 * a partial pack still helps.
 */
export async function installFpsBoost(
  instance: InstanceProfile,
  onStatus?: (message: string) => void
): Promise<PresetModStatus[]> {
  assertModLoader(instance);
  const results: PresetModStatus[] = [];
  for (const mod of FPS_BOOST_MODS) {
    onStatus?.(`Installing ${mod.name}…`);
    try {
      await installProject(mod.slug, instance);
      results.push({ slug: mod.slug, name: mod.name, status: "installed" });
    } catch (error) {
      results.push({
        slug: mod.slug,
        name: mod.name,
        status: "skipped",
        detail: (error as Error).message
      });
    }
  }
  return results;
}

/** Locate the bundled companion-mod jar in packaged and dev layouts. */
async function findCompanionJar(): Promise<string | undefined> {
  const candidates = [
    join(process.resourcesPath ?? "", "companion-mod"),
    join(app.getAppPath(), "..", "companion-mod", "build", "libs")
  ];
  for (const dir of candidates) {
    try {
      const jars = (await readdir(dir)).filter((file) => file.endsWith(".jar") && !file.includes("-sources"));
      if (jars.length > 0) {
        jars.sort();
        return join(dir, jars[jars.length - 1]);
      }
    } catch {
      // Directory absent in this layout; try the next candidate.
    }
  }
  return undefined;
}

/**
 * Install the MonkeyPlay HUD companion mod (FPS/CPS/ping/keystrokes overlay)
 * plus its Fabric API dependency into the instance.
 */
export async function installCompanionMod(instance: InstanceProfile): Promise<string> {
  assertModLoader(instance);
  const jar = await findCompanionJar();
  if (!jar) {
    throw new Error(
      "The MonkeyPlay HUD jar is not bundled with this build. Build it with `./gradlew build` in companion-mod/ first."
    );
  }
  await mkdir(modsDir(instance), { recursive: true });
  await installProject("fabric-api", instance);
  const target = join(modsDir(instance), "monkeyplay-companion.jar");
  await copyFile(jar, target);
  return target;
}
