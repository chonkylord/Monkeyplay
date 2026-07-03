import type {
  AccountProfile,
  CreateInstanceInput,
  InstalledMod,
  InstanceProfile,
  LaunchEvent,
  LauncherSettings,
  ModrinthProject,
  NewsItem,
  PresetModStatus,
  RuntimeInfo,
  VersionSummary
} from "@shared/types";
import { create } from "zustand";

export interface LaunchState {
  active: boolean;
  phase?: LaunchEvent["phase"];
  message?: string;
  progressPct?: number;
  failed: boolean;
}

const idleLaunch: LaunchState = { active: false, failed: false };

interface LauncherState {
  accounts: AccountProfile[];
  instances: InstanceProfile[];
  java: RuntimeInfo[];
  launches: LaunchEvent[];
  launchState: LaunchState;
  modrinthResults: ModrinthProject[];
  mods: InstalledMod[];
  news: NewsItem[];
  presetStatuses?: PresetModStatus[];
  settings?: LauncherSettings;
  selectedInstanceId?: string;
  totalMemoryMb: number;
  versions: VersionSummary[];
  busy: boolean;
  error?: string;
  notice?: string;
  bootstrap: () => Promise<void>;
  loadVersions: () => Promise<void>;
  loadNews: () => Promise<void>;
  loadMods: (instanceId: string) => Promise<void>;
  createInstance: (input: CreateInstanceInput) => Promise<void>;
  updateInstance: (id: string, update: Partial<CreateInstanceInput>) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  selectInstance: (id: string) => void;
  createOfflineAccount: (username: string) => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  signInMicrosoft: () => Promise<void>;
  launchGame: (instanceId: string, serverAddress?: string) => Promise<void>;
  searchModrinth: (query: string, projectType: "mod" | "shader") => Promise<void>;
  installModrinth: (projectId: string, instanceId: string) => Promise<void>;
  toggleMod: (instanceId: string, fileName: string, enabled: boolean) => Promise<void>;
  deleteMod: (instanceId: string, fileName: string) => Promise<void>;
  installFpsBoost: (instanceId: string) => Promise<void>;
  installCompanion: (instanceId: string) => Promise<void>;
  updateSettings: (settings: Partial<LauncherSettings>) => Promise<void>;
  appendLaunchEvent: (event: LaunchEvent) => void;
  dismissError: () => void;
  dismissNotice: () => void;
}

function selectedInstance(instances: InstanceProfile[], selectedInstanceId?: string): string | undefined {
  return selectedInstanceId ?? instances[0]?.id;
}

export const useLauncherStore = create<LauncherState>((set, get) => ({
  accounts: [],
  instances: [],
  java: [],
  launches: [],
  launchState: idleLaunch,
  modrinthResults: [],
  mods: [],
  news: [],
  versions: [],
  totalMemoryMb: 16384,
  busy: false,
  bootstrap: async () => {
    set({ busy: true, error: undefined });
    try {
      const [settings, instances, accounts, java, totalMemoryMb] = await Promise.all([
        window.monkeyplay.settings.get(),
        window.monkeyplay.instances.list(),
        window.monkeyplay.accounts.list(),
        window.monkeyplay.system.java(),
        window.monkeyplay.system.totalMemoryMb()
      ]);
      set({
        settings,
        instances,
        accounts,
        java,
        totalMemoryMb,
        selectedInstanceId: selectedInstance(instances, get().selectedInstanceId),
        busy: false
      });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
    // Non-critical extras load after the core state so a slow network never
    // blocks the launcher from becoming interactive.
    void get().loadVersions();
    void get().loadNews();
  },
  loadVersions: async () => {
    try {
      set({ versions: await window.monkeyplay.versions.list() });
    } catch {
      // Offline: the manual version input still works.
    }
  },
  loadNews: async () => {
    try {
      set({ news: await window.monkeyplay.news.list() });
    } catch {
      // Offline: the news strip simply stays empty.
    }
  },
  loadMods: async (instanceId) => {
    try {
      set({ mods: await window.monkeyplay.mods.list(instanceId) });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  createInstance: async (input) => {
    set({ busy: true, error: undefined });
    try {
      const instance = await window.monkeyplay.instances.create(input);
      set((state) => ({
        instances: [...state.instances, instance],
        selectedInstanceId: instance.id,
        busy: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  updateInstance: async (id, update) => {
    set({ busy: true, error: undefined });
    try {
      const updated = await window.monkeyplay.instances.update(id, update);
      set((state) => ({
        instances: state.instances.map((instance) => (instance.id === id ? updated : instance)),
        busy: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  deleteInstance: async (id) => {
    set({ busy: true, error: undefined });
    try {
      await window.monkeyplay.instances.delete(id);
      set((state) => {
        const instances = state.instances.filter((instance) => instance.id !== id);
        return {
          instances,
          selectedInstanceId: state.selectedInstanceId === id ? instances[0]?.id : state.selectedInstanceId,
          busy: false
        };
      });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  selectInstance: (id) => {
    set({ selectedInstanceId: id, mods: [], presetStatuses: undefined });
  },
  setActiveAccount: async (accountId) => {
    set({ busy: true, error: undefined });
    try {
      const accounts = await window.monkeyplay.accounts.setActive(accountId);
      set({ accounts, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  deleteAccount: async (accountId) => {
    set({ busy: true, error: undefined });
    try {
      await window.monkeyplay.accounts.delete(accountId);
      set((state) => ({ accounts: state.accounts.filter((account) => account.id !== accountId), busy: false }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  signInMicrosoft: async () => {
    set({ busy: true, error: undefined, notice: undefined });
    try {
      const device = await window.monkeyplay.auth.requestDeviceCode();
      if (device.verificationUri) {
        await window.monkeyplay.system.openExternal(device.verificationUri);
      }
      set({
        notice: `Microsoft sign-in: enter code ${device.userCode} at ${device.verificationUri} — this finishes automatically.`
      });
      const result = await window.monkeyplay.auth.completeDeviceCode(device.deviceCode);
      const accounts = await window.monkeyplay.accounts.list();
      set({ accounts, busy: false, notice: `Signed in as ${result.username}.` });
    } catch (error) {
      set({ error: (error as Error).message, busy: false, notice: undefined });
    }
  },
  createOfflineAccount: async (username) => {
    set({ busy: true, error: undefined });
    try {
      const account = await window.monkeyplay.accounts.createOffline(username);
      set((state) => ({
        accounts: [...state.accounts.filter((item) => item.id !== account.id).map((item) => ({ ...item, active: false })), account],
        busy: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  launchGame: async (instanceId, serverAddress) => {
    set({ error: undefined, launchState: { active: true, failed: false, message: "Preparing launch…" } });
    try {
      await window.monkeyplay.launch.start({ instanceId, serverAddress });
    } catch (error) {
      set({
        error: (error as Error).message,
        launchState: { active: false, failed: true, message: (error as Error).message }
      });
    }
  },
  searchModrinth: async (query, projectType) => {
    if (!query.trim()) {
      set({ modrinthResults: [] });
      return;
    }
    set({ busy: true, error: undefined });
    try {
      const modrinthResults = await window.monkeyplay.modrinth.search(query, projectType);
      set({ modrinthResults, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  installModrinth: async (projectId, instanceId) => {
    set({ busy: true, error: undefined });
    try {
      await window.monkeyplay.modrinth.install(projectId, instanceId);
      set({ busy: false, notice: "Installed from Modrinth." });
      await get().loadMods(instanceId);
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  toggleMod: async (instanceId, fileName, enabled) => {
    try {
      await window.monkeyplay.mods.setEnabled(instanceId, fileName, enabled);
      set((state) => ({
        mods: state.mods.map((mod) => (mod.fileName === fileName ? { ...mod, enabled } : mod))
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  deleteMod: async (instanceId, fileName) => {
    try {
      await window.monkeyplay.mods.delete(instanceId, fileName);
      set((state) => ({ mods: state.mods.filter((mod) => mod.fileName !== fileName) }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
  installFpsBoost: async (instanceId) => {
    set({ busy: true, error: undefined, presetStatuses: undefined });
    try {
      const presetStatuses = await window.monkeyplay.mods.installFpsBoost(instanceId);
      const installed = presetStatuses.filter((item) => item.status === "installed").length;
      set({ presetStatuses, busy: false, notice: `Performance pack: ${installed}/${presetStatuses.length} mods installed.` });
      await get().loadMods(instanceId);
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  installCompanion: async (instanceId) => {
    set({ busy: true, error: undefined });
    try {
      await window.monkeyplay.mods.installCompanion(instanceId);
      set({ busy: false, notice: "MonkeyPlay HUD installed (FPS, CPS, ping, keystrokes overlay)." });
      await get().loadMods(instanceId);
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  updateSettings: async (settingsUpdate) => {
    set({ busy: true, error: undefined });
    try {
      const settings = await window.monkeyplay.settings.update(settingsUpdate);
      set({ settings, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  appendLaunchEvent: (event) =>
    set((state) => {
      const launches = [event, ...state.launches].slice(0, 120);
      let launchState: LaunchState = state.launchState;
      if (event.phase === "failed") {
        launchState = { active: false, failed: true, phase: event.phase, message: event.message };
      } else if (event.phase === "exited") {
        launchState = { active: false, failed: Boolean(event.exitCode), phase: event.phase, message: event.message };
      } else {
        launchState = {
          active: true,
          failed: false,
          phase: event.phase,
          message: event.message,
          progressPct: event.progressPct ?? (event.phase === "running" ? 100 : undefined)
        };
      }
      return { launches, launchState };
    }),
  dismissError: () => set({ error: undefined }),
  dismissNotice: () => set({ notice: undefined })
}));
