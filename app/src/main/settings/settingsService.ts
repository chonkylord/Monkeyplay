import type { LauncherSettings } from "@shared/types";
import { join } from "node:path";
import { dataRoot } from "../paths";
import { readJson, writeJson } from "../storage";

const defaultSettings: LauncherSettings = {
  theme: "system",
  concurrentDownloads: 4,
  defaultRamMb: 4096,
  defaultJvmArgs: ["-XX:+UseG1GC", "-XX:+UnlockExperimentalVMOptions"],
  modrinthUserAgent: "ChunkyPlay/0.1.0 (contact: local-dev)"
};

function settingsPath(): string {
  return join(dataRoot(), "settings.json");
}

export async function getSettings(): Promise<LauncherSettings> {
  return { ...defaultSettings, ...(await readJson<Partial<LauncherSettings>>(settingsPath(), {})) };
}

export async function updateSettings(update: Partial<LauncherSettings>): Promise<LauncherSettings> {
  const next = { ...(await getSettings()), ...update };
  await writeJson(settingsPath(), next);
  return next;
}

