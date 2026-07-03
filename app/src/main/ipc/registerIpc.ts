import type { BrowserWindow } from "electron";
import { ipcMain, shell } from "electron";
import { totalmem } from "node:os";
import type { CreateInstanceInput, LaunchRequest } from "@shared/types";
import { createOfflineAccount, deleteAccount, listAccounts, setActiveAccount } from "../auth/accountService";
import { completeDeviceCode, requestDeviceCode } from "../auth/microsoftAuth";
import { createInstance, deleteInstance, getInstance, listInstances, updateInstance } from "../instances/instanceService";
import { detectJavaRuntimes } from "../java/javaService";
import { launch, onLaunchEvent } from "../launch-core/launchService";
import { listVersions } from "../launch-core/mojang";
import { deleteMod, installCompanionMod, installFpsBoost, listMods, setModEnabled } from "../mods/modService";
import { installProject, searchProjects } from "../modrinth/modrinthClient";
import { getNews } from "../news/newsService";
import { getSettings, updateSettings } from "../settings/settingsService";

async function requireInstance(instanceId: string) {
  const instance = await getInstance(instanceId);
  if (!instance) {
    throw new Error(`Instance not found: ${instanceId}`);
  }
  return instance;
}

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

  ipcMain.handle("launch:start", (_event, request: LaunchRequest) => launch(request));

  ipcMain.handle("accounts:list", () => listAccounts());
  ipcMain.handle("accounts:createOffline", (_event, username: string) => createOfflineAccount(username));
  ipcMain.handle("accounts:setActive", (_event, accountId: string) => setActiveAccount(accountId));
  ipcMain.handle("accounts:delete", (_event, accountId: string) => deleteAccount(accountId));
  ipcMain.handle("auth:deviceCode", () => requestDeviceCode());
  ipcMain.handle("auth:completeDeviceCode", (_event, deviceCode: string) => completeDeviceCode(deviceCode));

  ipcMain.handle("versions:list", () => listVersions());
  ipcMain.handle("news:list", () => getNews());

  ipcMain.handle("modrinth:search", (_event, query: string, projectType: "mod" | "shader") => searchProjects(query, projectType));
  ipcMain.handle("modrinth:install", async (_event, projectId: string, instanceId: string) =>
    installProject(projectId, await requireInstance(instanceId))
  );

  ipcMain.handle("mods:list", async (_event, instanceId: string) => listMods(await requireInstance(instanceId)));
  ipcMain.handle("mods:setEnabled", async (_event, instanceId: string, fileName: string, enabled: boolean) =>
    setModEnabled(await requireInstance(instanceId), fileName, enabled)
  );
  ipcMain.handle("mods:delete", async (_event, instanceId: string, fileName: string) =>
    deleteMod(await requireInstance(instanceId), fileName)
  );
  ipcMain.handle("mods:installFpsBoost", async (_event, instanceId: string) =>
    installFpsBoost(await requireInstance(instanceId))
  );
  ipcMain.handle("mods:installCompanion", async (_event, instanceId: string) =>
    installCompanionMod(await requireInstance(instanceId))
  );

  ipcMain.handle("system:java", () => detectJavaRuntimes());
  ipcMain.handle("system:totalMemoryMb", () => Math.floor(totalmem() / (1024 * 1024)));
  ipcMain.handle("system:openExternal", (_event, url: string) => shell.openExternal(url));
  ipcMain.handle("system:openPath", async (_event, path: string) => {
    await shell.openPath(path);
  });

  ipcMain.handle("window:minimize", () => window.minimize());
  ipcMain.handle("window:toggleMaximize", () => (window.isMaximized() ? window.unmaximize() : window.maximize()));
  ipcMain.handle("window:close", () => window.close());
}
