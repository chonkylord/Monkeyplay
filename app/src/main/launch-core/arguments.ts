import type { AccountProfile, InstanceProfile } from "@shared/types";
import { delimiter } from "node:path";
import { rulesAllow } from "./rules";
import type { VersionJson } from "./mojang";

type ArgumentPart = string | { rules?: Parameters<typeof rulesAllow>[0]; value: string | string[] };

export interface LaunchArgumentsInput {
  version: VersionJson;
  instance: InstanceProfile;
  account: Pick<AccountProfile, "username" | "uuid"> & { accessToken: string };
  classpath: string[];
  clientJar: string;
  nativesDir: string;
  assetsRoot: string;
  assetIndex: string;
  launcherName?: string;
  launcherVersion?: string;
}

function flattenArguments(parts: ArgumentPart[] | undefined): string[] {
  if (!parts) {
    return [];
  }
  const output: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      output.push(part);
      continue;
    }
    if (!rulesAllow(part.rules)) {
      continue;
    }
    output.push(...(Array.isArray(part.value) ? part.value : [part.value]));
  }
  return output;
}

function replaceTokens(value: string, replacements: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)}/g, (_, key: string) => replacements[key] ?? "");
}

export function buildLaunchArguments(input: LaunchArgumentsInput): string[] {
  const classpath = [...input.classpath, input.clientJar].join(delimiter);
  const replacements: Record<string, string> = {
    auth_player_name: input.account.username,
    version_name: input.version.id,
    game_directory: input.instance.gameDir,
    assets_root: input.assetsRoot,
    assets_index_name: input.assetIndex,
    auth_uuid: input.account.uuid.replace(/-/g, ""),
    auth_access_token: input.account.accessToken,
    user_type: "msa",
    version_type: "release",
    natives_directory: input.nativesDir,
    launcher_name: input.launcherName ?? "MonkeyPlay",
    launcher_version: input.launcherVersion ?? "0.1.0",
    classpath
  };

  const jvmArgs = flattenArguments(input.version.arguments?.jvm);
  const gameArgs = input.version.minecraftArguments
    ? input.version.minecraftArguments.split(" ")
    : flattenArguments(input.version.arguments?.game);

  // Pre-allocate a sane minimum heap so the JVM does not spend the first
  // seconds growing the heap, while never exceeding the configured maximum.
  const minHeapMb = Math.max(512, Math.min(input.instance.ramMb, 1024));

  return [
    ...input.instance.jvmArgs,
    `-Xms${Math.min(minHeapMb, input.instance.ramMb)}M`,
    `-Xmx${input.instance.ramMb}M`,
    ...jvmArgs.map((arg) => replaceTokens(arg, replacements)),
    input.version.mainClass,
    ...gameArgs.map((arg) => replaceTokens(arg, replacements))
  ].filter(Boolean);
}

