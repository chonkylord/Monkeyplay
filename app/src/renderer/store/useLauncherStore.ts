import type {
  AccountProfile,
  CreateInstanceInput,
  InstanceProfile,
  LaunchEvent,
  LauncherSettings,
  ModrinthProject,
  RuntimeInfo
} from "@shared/types";
import { create } from "zustand";

interface LauncherState {
  accounts: AccountProfile[];
  instances: InstanceProfile[];
  java: RuntimeInfo[];
  launches: LaunchEvent[];
  modrinthResults: ModrinthProject[];
  settings?: LauncherSettings;
  selectedInstanceId?: string;
  totalMemoryMb: number;
  busy: boolean;
  error?: string;
  bootstrap: () => Promise<void>;
  createInstance: (input: CreateInstanceInput) => Promise<void>;
  updateInstance: (id: string, update: Partial<CreateInstanceInput>) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  selectInstance: (id: string) => void;
  createOfflineAccount: (username: string) => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  signInMicrosoft: () => Promise<void>;
  launchOffline: (instanceId: string, username?: string) => Promise<void>;
  searchModrinth: (query: string, projectType: "mod" | "shader") => Promise<void>;
  installModrinth: (projectId: string, instanceId: string) => Promise<void>;
  updateSettings: (settings: Partial<LauncherSettings>) => Promise<void>;
  appendLaunchEvent: (event: LaunchEvent) => void;
  dismissError: () => void;
  notice?: string;
}

function selectedInstance(instances: InstanceProfile[], selectedInstanceId?: string): string | undefined {
  return selectedInstanceId ?? instances[0]?.id;
}

export const useLauncherStore = create<LauncherState>((set, get) => ({
  accounts: [],
  instances: [],
  java: [],
  launches: [],
  modrinthResults: [],
  totalMemoryMb: 16384,
  busy: false,
  bootstrap: async () => {
    set({ busy: true, error: undefined });
    try {
      const [settings, instances, accounts, java, totalMemoryMb] = await Promise.all([
        window.chunkyplay.settings.get(),
        window.chunkyplay.instances.list(),
        window.chunkyplay.accounts.list(),
        window.chunkyplay.system.java(),
        window.chunkyplay.system.totalMemoryMb()
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
  },
  createInstance: async (input) => {
    set({ busy: true, error: undefined });
    try {
      const instance = await window.chunkyplay.instances.create(input);
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
      const updated = await window.chunkyplay.instances.update(id, update);
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
      await window.chunkyplay.instances.delete(id);
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
  selectInstance: (id) => set({ selectedInstanceId: id }),
  setActiveAccount: async (accountId) => {
    set({ busy: true, error: undefined });
    try {
      const accounts = await window.chunkyplay.accounts.setActive(accountId);
      set({ accounts, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  deleteAccount: async (accountId) => {
    set({ busy: true, error: undefined });
    try {
      await window.chunkyplay.accounts.delete(accountId);
      set((state) => ({ accounts: state.accounts.filter((account) => account.id !== accountId), busy: false }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  signInMicrosoft: async () => {
    set({ busy: true, error: undefined, notice: undefined });
    try {
      const device = await window.chunkyplay.auth.requestDeviceCode();
      if (device.verificationUri) {
        await window.chunkyplay.system.openExternal(device.verificationUri);
      }
      set({
        notice: `Microsoft sign-in: enter code ${device.userCode} at ${device.verificationUri}, then this window finishes automatically.`
      });
      const result = await window.chunkyplay.auth.completeDeviceCode(device.deviceCode);
      const accounts = await window.chunkyplay.accounts.list();
      set({ accounts, busy: false, notice: `Signed in as ${result.username}.` });
    } catch (error) {
      set({ error: (error as Error).message, busy: false, notice: undefined });
    }
  },
  createOfflineAccount: async (username) => {
    set({ busy: true, error: undefined });
    try {
      const account = await window.chunkyplay.accounts.createOffline(username);
      set((state) => ({
        accounts: [...state.accounts.filter((item) => item.id !== account.id).map((item) => ({ ...item, active: false })), account],
        busy: false
      }));
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  launchOffline: async (instanceId, username) => {
    set({ busy: true, error: undefined });
    try {
      await window.chunkyplay.launch.offline({ instanceId, offlineUsername: username });
      set({ busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  searchModrinth: async (query, projectType) => {
    if (!query.trim()) {
      set({ modrinthResults: [] });
      return;
    }
    set({ busy: true, error: undefined });
    try {
      const modrinthResults = await window.chunkyplay.modrinth.search(query, projectType);
      set({ modrinthResults, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  installModrinth: async (projectId, instanceId) => {
    set({ busy: true, error: undefined });
    try {
      await window.chunkyplay.modrinth.install(projectId, instanceId);
      set({ busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  updateSettings: async (settingsUpdate) => {
    set({ busy: true, error: undefined });
    try {
      const settings = await window.chunkyplay.settings.update(settingsUpdate);
      set({ settings, busy: false });
    } catch (error) {
      set({ error: (error as Error).message, busy: false });
    }
  },
  appendLaunchEvent: (event) =>
    set((state) => ({
      launches: [event, ...state.launches].slice(0, 80)
    })),
  dismissError: () => set({ error: undefined })
}));

