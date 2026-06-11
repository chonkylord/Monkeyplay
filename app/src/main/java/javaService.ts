import type { RuntimeInfo } from "@shared/types";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

const versionPattern = /version "(?:(\d+)\.)?(?:(\d+)\.)?(\d+)/;

function parseJavaMajor(stderr: string): number | undefined {
  const match = stderr.match(versionPattern);
  if (!match) {
    return undefined;
  }
  if (match[1] === "1" && match[2]) {
    return Number(match[2]);
  }
  return Number(match[1] ?? match[3]);
}

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function probeJava(path: string, source: RuntimeInfo["source"]): RuntimeInfo | undefined {
  const result = spawnSync(path, ["-version"], { encoding: "utf8" });
  const major = parseJavaMajor(`${result.stderr}\n${result.stdout}`);
  if (result.status === 0 && major) {
    return { path, major, source };
  }
  return undefined;
}

export function requiredJavaMajor(minecraftVersion: string): 8 | 17 | 21 {
  const [major, minor, patch = 0] = minecraftVersion.split(".").map((part) => Number(part.replace(/\D.*$/, "")));
  if (major === 1 && minor <= 16) {
    return 8;
  }
  if (major === 1 && (minor < 20 || (minor === 20 && patch <= 4))) {
    return 17;
  }
  return 21;
}

export async function detectJavaRuntimes(): Promise<RuntimeInfo[]> {
  const candidates = new Map<string, RuntimeInfo["source"]>();
  if (process.env.JAVA_HOME) {
    candidates.set(join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"), "java-home");
  }
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (entry) {
      candidates.set(join(entry, process.platform === "win32" ? "java.exe" : "java"), "path");
    }
  }

  const runtimes: RuntimeInfo[] = [];
  for (const [path, source] of candidates) {
    if (await canAccess(path)) {
      const runtime = probeJava(path, source);
      if (runtime && !runtimes.some((item) => item.path === runtime.path)) {
        runtimes.push(runtime);
      }
    }
  }
  return runtimes.sort((a, b) => b.major - a.major);
}

export async function selectJavaRuntime(minecraftVersion: string): Promise<RuntimeInfo> {
  const required = requiredJavaMajor(minecraftVersion);
  const runtimes = await detectJavaRuntimes();
  const exact = runtimes.find((runtime) => runtime.major === required);
  const compatible = runtimes.find((runtime) => runtime.major > required);
  const selected = exact ?? compatible;
  if (!selected) {
    throw new Error(`Java ${required} is required for Minecraft ${minecraftVersion}, and no compatible runtime was detected.`);
  }
  return selected;
}

