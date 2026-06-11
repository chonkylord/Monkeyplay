import type { AccountProfile, LaunchEvent, LaunchRequest, LaunchResult } from "@shared/types";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getInstance } from "../instances/instanceService";
import { selectJavaRuntime } from "../java/javaService";
import { logsRoot, sharedRoot } from "../paths";
import { buildLaunchArguments } from "./arguments";
import { diagnose, formatDiagnosis } from "./diagnostics";
import { applyLoader } from "./loaders";
import { downloadAssets, downloadClientJar, downloadLibraries, resolveVersion } from "./mojang";
import { offlineUuid, sanitizeOfflineUsername } from "./offline";

type LaunchListener = (event: LaunchEvent) => void;

const listeners = new Set<LaunchListener>();

function emit(event: LaunchEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

function phase(launchId: string, instanceId: string, eventPhase: LaunchEvent["phase"], message: string, exitCode?: number | null): void {
  emit({
    id: launchId,
    instanceId,
    phase: eventPhase,
    message,
    timestamp: new Date().toISOString(),
    exitCode
  });
}

export function onLaunchEvent(listener: LaunchListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function launchOffline(request: LaunchRequest): Promise<LaunchResult> {
  const instance = await getInstance(request.instanceId);
  if (!instance) {
    throw new Error(`Instance not found: ${request.instanceId}`);
  }

  const launchId = randomUUID();
  await mkdir(logsRoot(), { recursive: true });
  const logPath = join(logsRoot(), `${launchId}.log`);
  const log = createWriteStream(logPath, { flags: "a" });
  const username = sanitizeOfflineUsername(request.offlineUsername);
  const account: AccountProfile & { accessToken: string } = {
    id: `offline:${username}`,
    type: "offline",
    username,
    uuid: offlineUuid(username),
    active: true,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    accessToken: "0"
  };

  try {
    phase(launchId, instance.id, "resolving-version", `Resolving Minecraft ${instance.minecraftVersion}`);
    const baseVersion = await resolveVersion(instance.minecraftVersion);

    const loaderName = instance.loader === "vanilla" ? "vanilla" : `${instance.loader}`;
    phase(launchId, instance.id, "resolving-version", `Resolving ${loaderName} loader`);
    const { version, loaderVersion } = await applyLoader(
      baseVersion,
      instance.loader,
      instance.minecraftVersion,
      instance.loaderVersion
    );

    phase(launchId, instance.id, "downloading-client", "Checking client jar");
    const clientJar = await downloadClientJar(baseVersion);

    phase(launchId, instance.id, "downloading-libraries", "Checking libraries and natives");
    const libraries = await downloadLibraries(version);

    phase(launchId, instance.id, "downloading-assets", "Checking assets");
    const assetIndex = await downloadAssets(baseVersion);

    phase(launchId, instance.id, "provisioning-java", "Selecting Java runtime");
    const java = await selectJavaRuntime(instance.minecraftVersion, (message) =>
      phase(launchId, instance.id, "provisioning-java", message)
    );

    phase(
      launchId,
      instance.id,
      "building-command",
      `Using Java ${java.major}${loaderVersion ? ` · ${instance.loader} ${loaderVersion}` : ""}`
    );
    const args = buildLaunchArguments({
      version,
      instance,
      account,
      classpath: libraries.classpath,
      clientJar,
      nativesDir: libraries.nativesDir,
      assetsRoot: join(sharedRoot(), "assets"),
      assetIndex
    });

    log.write(`MonkeyPlay launch ${launchId}\n`);
    log.write(`Instance: ${instance.name} (${instance.loader}${loaderVersion ? ` ${loaderVersion}` : ""})\n`);
    log.write(`Java: ${java.path}\n`);
    log.write(`Args: ${args.map((arg) => (arg.includes("accessToken") ? "[redacted]" : arg)).join(" ")}\n\n`);

    const child = spawn(java.path, args, {
      cwd: instance.gameDir,
      env: process.env
    });

    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    phase(launchId, instance.id, "running", `Minecraft started with pid ${child.pid ?? "unknown"}`);

    child.once("exit", (code) => {
      const nonZero = typeof code === "number" && code !== 0;
      phase(
        launchId,
        instance.id,
        "exited",
        nonZero
          ? `Minecraft exited with code ${code}. See the launch log: ${logPath}`
          : `Minecraft exited with code ${code ?? "unknown"}`,
        code
      );
      log.end(`\nExit code: ${code ?? "unknown"}\n`);
    });
    child.once("error", (error) => {
      const diagnosis = diagnose(error);
      phase(launchId, instance.id, "failed", formatDiagnosis(diagnosis));
      log.end(`\nSpawn error: ${formatDiagnosis(diagnosis)}\n`);
    });

    return {
      launchId,
      pid: child.pid,
      logPath
    };
  } catch (error) {
    const diagnosis = diagnose(error);
    phase(launchId, instance.id, "failed", formatDiagnosis(diagnosis));
    log.end(`\nLaunch failed: ${formatDiagnosis(diagnosis)}\n`);
    throw new Error(formatDiagnosis(diagnosis));
  }
}

