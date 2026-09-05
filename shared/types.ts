export type LoaderType = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";

export type AccountType = "offline" | "microsoft";

export interface AccountProfile {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string;
}

export interface LauncherSettings {
  theme: "system" | "dark" | "light";
  concurrentDownloads: number;
  defaultRamMb: number;
  defaultJvmArgs: string[];
  modrinthUserAgent: string;
}

export interface InstanceProfile {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  javaMajor?: 8 | 17 | 21;
  ramMb: number;
  jvmArgs: string[];
  gameDir: string;
  /** Optional server to quick-join on launch, e.g. "play.example.net:25565". */
  serverAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstanceInput {
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  ramMb?: number;
  jvmArgs?: string[];
  serverAddress?: string;
}

export interface LaunchRequest {
  instanceId: string;
  accountId?: string;
  offlineUsername?: string;
  /** Overrides the instance's stored quick-join server for this launch. */
  serverAddress?: string;
}

export type LaunchPhase =
  | "queued"
  | "resolving-version"
  | "downloading-client"
  | "downloading-libraries"
  | "downloading-assets"
  | "provisioning-java"
  | "building-command"
  | "running"
  | "exited"
  | "failed";

export interface LaunchEvent {
  id: string;
  instanceId: string;
  phase: LaunchPhase;
  message: string;
  timestamp: string;
  exitCode?: number | null;
  /** 0-100 progress within the current phase, when the phase can measure it. */
  progressPct?: number;
}

export interface LaunchResult {
  launchId: string;
  pid?: number;
  logPath: string;
}

export interface DeviceCodeResponse {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export interface ModrinthProject {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  projectType: "mod" | "modpack" | "resourcepack" | "shader";
  downloads: number;
  iconUrl?: string;
  author?: string;
}

export interface RuntimeInfo {
  path: string;
  major: number;
  source: "java-home" | "path" | "bundled";
}

export interface VersionSummary {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
}

export interface InstalledMod {
  fileName: string;
  enabled: boolean;
  sizeBytes: number;
}

export interface PresetModStatus {
  slug: string;
  name: string;
  status: "installed" | "skipped";
  detail?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  version: string;
  category: string;
  date: string;
  imageUrl?: string;
  shortText: string;
}

export interface ServerStatus {
  address: string;
  host: string;
  port: number;
  online: boolean;
  latencyMs?: number;
  version?: { name: string; protocol: number };
  players?: { online: number; max: number; sample?: Array<{ name: string; id: string }> };
  motd?: string;
  motdRaw?: unknown;
  favicon?: string;
  description?: string;
  error?: string;
  /** Resolved host when SRV record was used */
  resolvedHost?: string;
  resolvedPort?: number;
  /** Network origin (publicly resolvable) */
  ip?: string;
  reverseDns?: string;
  geo?: {
    country?: string;
    countryCode?: string;
    regionName?: string;
    city?: string;
    zip?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
    isp?: string;
    org?: string;
    as?: string;
    query?: string;
  };
  /** Hardware requires server-side opt-in (see note below) */
  hardware?: {
    note: string;
  };
}

