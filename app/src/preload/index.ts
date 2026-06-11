import { contextBridge, ipcRenderer } from "electron";
import type {
  AccountProfile,
  CreateInstanceInput,
  DeviceCodeResponse,
  InstanceProfile,
  LaunchEvent,
  LaunchRequest,
  LaunchResult,
  LauncherSettings,
  ModrinthProject,
  RuntimeInfo
} from "@shared/types";

const api = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get") as Promise<LauncherSettings>,
    update: (update: Partial<LauncherSettings>) => ipcRenderer.invoke("settings:update", update) as Promise<LauncherSettings>
  },
  instances: {
    list: () => ipcRenderer.invoke("instances:list") as Promise<InstanceProfile[]>,
    create: (input: CreateInstanceInput) => ipcRenderer.invoke("instances:create", input) as Promise<InstanceProfile>,
    update: (id: string, update: Partial<CreateInstanceInput>) =>
      ipcRenderer.invoke("instances:update", id, update) as Promise<InstanceProfile>,
    delete: (id: string) => ipcRenderer.invoke("instances:delete", id) as Promise<void>
  },
  launch: {
    offline: (request: LaunchRequest) => ipcRenderer.invoke("launch:offline", request) as Promise<LaunchResult>,
    onEvent: (callback: (event: LaunchEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, launchEvent: LaunchEvent): void => callback(launchEvent);
      ipcRenderer.on("launch:event", listener);
      return () => {
        ipcRenderer.removeListener("launch:event", listener);
      };
    }
  },
  accounts: {
    list: () => ipcRenderer.invoke("accounts:list") as Promise<AccountProfile[]>,
    createOffline: (username: string) => ipcRenderer.invoke("accounts:createOffline", username) as Promise<AccountProfile>,
    setActive: (accountId: string) => ipcRenderer.invoke("accounts:setActive", accountId) as Promise<AccountProfile[]>,
    delete: (accountId: string) => ipcRenderer.invoke("accounts:delete", accountId) as Promise<void>
  },
  auth: {
    requestDeviceCode: () => ipcRenderer.invoke("auth:deviceCode") as Promise<DeviceCodeResponse>,
    completeDeviceCode: (deviceCode: string) => ipcRenderer.invoke("auth:completeDeviceCode", deviceCode) as Promise<{ accountId: string; username: string }>
  },
  modrinth: {
    search: (query: string, projectType: "mod" | "shader") =>
      ipcRenderer.invoke("modrinth:search", query, projectType) as Promise<ModrinthProject[]>,
    install: (projectId: string, instanceId: string) => ipcRenderer.invoke("modrinth:install", projectId, instanceId) as Promise<string[]>
  },
  system: {
    java: () => ipcRenderer.invoke("system:java") as Promise<RuntimeInfo[]>,
    totalMemoryMb: () => ipcRenderer.invoke("system:totalMemoryMb") as Promise<number>,
    openExternal: (url: string) => ipcRenderer.invoke("system:openExternal", url) as Promise<void>
  }
};

contextBridge.exposeInMainWorld("chunkyplay", api);

export type ChunkyPlayApi = typeof api;
