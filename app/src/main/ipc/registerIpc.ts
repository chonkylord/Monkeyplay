import type { BrowserWindow } from "electron";
import { ipcMain, shell } from "electron";
import { totalmem } from "node:os";
import type { CreateInstanceInput, LaunchRequest } from "@shared/types";
import { createOfflineAccount, deleteAccount, listAccounts, setActiveAccount } from "../auth/accountService";
import { completeDeviceCode, requestDeviceCode } from "../auth/microsoftAuth";
import { createInstance, deleteInstance, getInstance, listInstances, updateInstance } from "../instances/instanceService";
import { detectJavaRuntimes } from "../java/javaService";
import { launchOffline, onLaunchEvent } from "../launch-core/launchService";
import { installProject, searchProjects } from "../modrinth/modrinthClient";
import { getSettings, updateSettings } from "../settings/settingsService";

export function registerIpc(window: BrowserWindow): void {
  onLaunchEvent((event) => {
    if (!window.isDestroyed()) {
      window.webContents.send("launch:event", event);
    }
  });

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:update", (_event, update: Parameters<typeof updateSettings>[0]) => updateSettings(update));

  ipcMain.handle("instances:list", () => listInstances());
  ipcMain.handle("instances:create", (_event, input: CreateInstanceInput) => createInstance(input));
  ipcMain.handle("instances:update", (_event, id: string, update: Partial<CreateInstanceInput>) => updateInstance(id, update));
  ipcMain.handle("instances:delete", (_event, id: string) => deleteInstance(id));

  ipcMain.handle("launch:offline", (_event, request: LaunchRequest) => launchOffline(request));

  ipcMain.handle("accounts:list", () => listAccounts());
  ipcMain.handle("accounts:createOffline", (_event, username: string) => createOfflineAccount(username));
  ipcMain.handle("accounts:setActive", (_event, accountId: string) => setActiveAccount(accountId));
  ipcMain.handle("accounts:delete", (_event, accountId: string) => deleteAccount(accountId));
  ipcMain.handle("auth:deviceCode", () => requestDeviceCode());
  ipcMain.handle("auth:completeDeviceCode", (_event, deviceCode: string) => completeDeviceCode(deviceCode));

  ipcMain.handle("modrinth:search", (_event, query: string, projectType: "mod" | "shader") => searchProjects(query, projectType));
  ipcMain.handle("modrinth:install", async (_event, projectId: string, instanceId: string) => {
    const instance = await getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }
    return installProject(projectId, instance);
  });

  ipcMain.handle("system:java", () => detectJavaRuntimes());
  ipcMain.handle("system:totalMemoryMb", () => Math.floor(totalmem() / (1024 * 1024)));
  ipcMain.handle("system:openExternal", (_event, url: string) => shell.openExternal(url));
}

