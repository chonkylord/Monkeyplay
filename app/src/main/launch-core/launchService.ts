import type { LaunchEvent, LaunchRequest, LaunchResult } from "@shared/types";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { listAccounts } from "../auth/accountService";
import { refreshMinecraftSession } from "../auth/microsoftAuth";
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

function phase(
  launchId: string,
  instanceId: string,
  eventPhase: LaunchEvent["phase"],
  message: string,
  extras: { exitCode?: number | null; progressPct?: number } = {}
): void {
  emit({
    id: launchId,
    instanceId,
    phase: eventPhase,
    message,
    timestamp: new Date().toISOString(),
    ...extras
  });
}

export function onLaunchEvent(listener: LaunchListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface LaunchSession {
  username: string;
  uuid: string;
  accessToken: string;
}

/**
 * Pick the session for this launch: a signed-in Microsoft account launches
 * authenticated (token renewed silently from the stored refresh token), any
 * other case falls back to an offline session.
 */
async function resolveSession(request: LaunchRequest): Promise<LaunchSession> {
  const accounts = await listAccounts();
  const account = request.accountId
    ? accounts.find((item) => item.id === request.accountId)
    : accounts.find((item) => item.active);

  if (account?.type === "microsoft") {
    const session = await refreshMinecraftSession(account.id);
    return { username: session.username, uuid: session.uuid, accessToken: session.accessToken };
  }

  const username = sanitizeOfflineUsername(request.offlineUsername ?? account?.username);
  return { username, uuid: offlineUuid(username), accessToken: "0" };
}

export async function launch(request: LaunchRequest): Promise<LaunchResult> {
  const instance = await getInstance(request.instanceId);
  if (!instance) {
    throw new Error(`Instance not found: ${request.instanceId}`);
  }

  const launchId = randomUUID();
  await mkdir(logsRoot(), { recursive: true });
  const logPath = join(logsRoot(), `${launchId}.log`);
  const log = createWriteStream(logPath, { flags: "a" });

  try {
    phase(launchId, instance.id, "queued", "Preparing account session");
    const session = await resolveSession(request);

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
    const libraries = await downloadLibraries(version, (done, total) => {
      const pct = total > 0 ? Math.round((done / total) * 100) : 100;
      phase(launchId, instance.id, "downloading-libraries", `Downloading libraries ${done}/${total}`, { progressPct: pct });
    });

    phase(launchId, instance.id, "downloading-assets", "Checking assets");
    const assetIndex = await downloadAssets(baseVersion, (done, total) => {
      const pct = total > 0 ? Math.round((done / total) * 100) : 100;
      phase(launchId, instance.id, "downloading-assets", `Downloading assets ${done}/${total} (${pct}%)`, {
        progressPct: pct
      });
    });

    phase(launchId, instance.id, "provisioning-java", "Selecting Java runtime");
    const java = await selectJavaRuntime(instance.minecraftVersion, (message) =>
      phase(launchId, instance.id, "provisioning-java", message)
    );

    const quickPlayServer = request.serverAddress ?? instance.serverAddress;
    phase(
      launchId,
      instance.id,
      "building-command",
      `Using Java ${java.major}${loaderVersion ? ` · ${instance.loader} ${loaderVersion}` : ""}${
        quickPlayServer ? ` · joining ${quickPlayServer}` : ""
      }`
    );
    const args = buildLaunchArguments({
      version,
      instance,
      account: session,
      classpath: libraries.classpath,
      clientJar,
      nativesDir: libraries.nativesDir,
      assetsRoot: join(sharedRoot(), "assets"),
      assetIndex,
      quickPlayServer
    });

    log.write(`MonkeyPlay launch ${launchId}\n`);
    log.write(`Instance: ${instance.name} (${instance.loader}${loaderVersion ? ` ${loaderVersion}` : ""})\n`);
    log.write(`Account: ${session.username}\n`);
    log.write(`Java: ${java.path}\n`);
    log.write(`Args: ${args.map((arg) => (arg === session.accessToken ? "[redacted]" : arg)).join(" ")}\n\n`);

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
        { exitCode: code }
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
