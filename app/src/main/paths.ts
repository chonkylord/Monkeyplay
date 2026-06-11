import { app } from "electron";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export function dataRoot(): string {
  return process.env.MONKEYPLAY_DATA_DIR ?? app.getPath("userData");
}

export function sharedRoot(): string {
  return join(dataRoot(), "shared");
}

export function instanceRoot(): string {
  return join(dataRoot(), "instances");
}

export function logsRoot(): string {
  return join(dataRoot(), "logs");
}

export function runtimesRoot(): string {
  return join(dataRoot(), "runtimes");
}

export async function ensureBaseLayout(): Promise<void> {
  await Promise.all([
    mkdir(dataRoot(), { recursive: true }),
    mkdir(instanceRoot(), { recursive: true }),
    mkdir(join(sharedRoot(), "assets"), { recursive: true }),
    mkdir(join(sharedRoot(), "libraries"), { recursive: true }),
    mkdir(join(sharedRoot(), "versions"), { recursive: true }),
    mkdir(join(sharedRoot(), "natives"), { recursive: true }),
    mkdir(runtimesRoot(), { recursive: true }),
    mkdir(logsRoot(), { recursive: true })
  ]);
}

