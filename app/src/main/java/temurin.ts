import type { RuntimeInfo } from "@shared/types";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { runtimesRoot } from "../paths";
import { downloadFile } from "../launch-core/download";

// extract-zip is CommonJS; load it lazily to avoid an ESM preparse crash.
const require = createRequire(import.meta.url);
const extract = require("extract-zip") as (zipPath: string, opts: { dir: string }) => Promise<void>;

const javaBinaryName = process.platform === "win32" ? "java.exe" : "java";

function adoptiumOs(): string {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

function adoptiumArch(): string {
  switch (process.arch) {
    case "arm64":
      return "aarch64";
    case "ia32":
      return "x86";
    default:
      return "x64";
  }
}

/** Recursively locate the `bin/java[.exe]` produced by extracting a Temurin archive. */
async function findJavaBinary(dir: string, depth = 0): Promise<string | undefined> {
  if (depth > 4) {
    return undefined;
  }
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name === "bin") {
      const candidate = join(full, javaBinaryName);
      try {
        if ((await stat(candidate)).isFile()) {
          return candidate;
        }
      } catch {
        // keep searching
      }
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = await findJavaBinary(join(dir, entry.name), depth + 1);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

async function extractTarGz(archive: string, dest: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xzf", archive, "-C", dest], { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited with code ${code ?? "unknown"}`))));
  });
}

/**
 * Ensure an Eclipse Temurin JRE of the given major version is available,
 * downloading and extracting it under the launcher's runtimes directory on
 * first use. Subsequent launches reuse the cached runtime.
 */
export async function ensureTemurinJre(major: 8 | 17 | 21, onStatus?: (message: string) => void): Promise<RuntimeInfo> {
  const dest = join(runtimesRoot(), `temurin-${major}`);

  const cached = await findJavaBinary(dest);
  if (cached) {
    return { path: cached, major, source: "bundled" };
  }

  const os = adoptiumOs();
  const arch = adoptiumArch();
  const extension = os === "windows" ? "zip" : "tar.gz";
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;
  const archive = join(runtimesRoot(), `temurin-${major}.${extension}`);

  onStatus?.(`Downloading Java ${major} runtime (Temurin ${arch})…`);
  await mkdir(runtimesRoot(), { recursive: true });
  await downloadFile(url, archive);

  onStatus?.(`Installing Java ${major} runtime…`);
  await mkdir(dest, { recursive: true });
  if (extension === "zip") {
    await extract(archive, { dir: dest });
  } else {
    await extractTarGz(archive, dest);
  }
  await rm(archive, { force: true });

  const javaPath = await findJavaBinary(dest);
  if (!javaPath) {
    throw new Error(`Downloaded Temurin ${major} runtime but could not locate its java executable.`);
  }
  onStatus?.(`Java ${major} runtime ready.`);
  return { path: javaPath, major, source: "bundled" };
}
