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
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstanceInput {
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  ramMb?: number;
  jvmArgs?: string[];
}

export interface LaunchRequest {
  instanceId: string;
  accountId?: string;
  offlineUsername?: string;
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

