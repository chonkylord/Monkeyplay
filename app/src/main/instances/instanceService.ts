import type { CreateInstanceInput, InstanceProfile } from "@shared/types";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { dataRoot, instanceRoot } from "../paths";
import { readJson, writeJson } from "../storage";
import { getSettings } from "../settings/settingsService";

function indexPath(): string {
  return join(dataRoot(), "instances.json");
}

function safeName(name: string): string {
  const invalid = new Set(["<", ">", ":", "\"", "/", "\\", "|", "?", "*"]);
  return name
    .trim()
    .split("")
    .map((char) => (invalid.has(char) || char.charCodeAt(0) < 32 ? "-" : char))
    .join("")
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

async function readIndex(): Promise<InstanceProfile[]> {
  return readJson<InstanceProfile[]>(indexPath(), []);
}

async function writeIndex(instances: InstanceProfile[]): Promise<void> {
  await writeJson(indexPath(), instances);
}

async function makeInstanceDirs(gameDir: string): Promise<void> {
  await Promise.all([
    mkdir(gameDir, { recursive: true }),
    mkdir(join(gameDir, "mods"), { recursive: true }),
    mkdir(join(gameDir, "config"), { recursive: true }),
    mkdir(join(gameDir, "saves"), { recursive: true }),
    mkdir(join(gameDir, "resourcepacks"), { recursive: true }),
    mkdir(join(gameDir, "shaderpacks"), { recursive: true })
  ]);
}

export async function listInstances(): Promise<InstanceProfile[]> {
  return readIndex();
}

export async function getInstance(id: string): Promise<InstanceProfile | undefined> {
  return (await readIndex()).find((instance) => instance.id === id);
}

export async function createInstance(input: CreateInstanceInput): Promise<InstanceProfile> {
  const settings = await getSettings();
  const now = new Date().toISOString();
  const id = randomUUID();
  const name = safeName(input.name);
  if (!name) {
    throw new Error("Instance name is required.");
  }
  const gameDir = join(instanceRoot(), `${name}-${id.slice(0, 8)}`);
  const profile: InstanceProfile = {
    id,
    name,
    minecraftVersion: input.minecraftVersion,
    loader: input.loader,
    ramMb: input.ramMb ?? settings.defaultRamMb,
    jvmArgs: input.jvmArgs ?? settings.defaultJvmArgs,
    ...(input.serverAddress ? { serverAddress: input.serverAddress } : {}),
    gameDir,
    createdAt: now,
    updatedAt: now
  };
  await makeInstanceDirs(gameDir);
  const instances = await readIndex();
  await writeIndex([...instances, profile]);
  await writeJson(join(gameDir, "instance.json"), profile);
  return profile;
}

export async function updateInstance(id: string, update: Partial<CreateInstanceInput>): Promise<InstanceProfile> {
  const instances = await readIndex();
  const index = instances.findIndex((instance) => instance.id === id);
  if (index === -1) {
    throw new Error(`Instance not found: ${id}`);
  }
  const current = instances[index];
  const next: InstanceProfile = {
    ...current,
    ...update,
    name: update.name ? safeName(update.name) : current.name,
    ramMb: update.ramMb ?? current.ramMb,
    jvmArgs: update.jvmArgs ?? current.jvmArgs,
    updatedAt: new Date().toISOString()
  };
  instances[index] = next;
  await writeIndex(instances);
  await writeJson(join(next.gameDir, "instance.json"), next);
  return next;
}

export async function deleteInstance(id: string): Promise<void> {
  const instances = await readIndex();
  const target = instances.find((instance) => instance.id === id);
  if (!target) {
    return;
  }
  await writeIndex(instances.filter((instance) => instance.id !== id));
  await rm(target.gameDir, { recursive: true, force: true });
}
