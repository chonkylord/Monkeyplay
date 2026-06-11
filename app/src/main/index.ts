import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { join } from "node:path";
import { ensureBaseLayout } from "./paths";
import { registerIpc } from "./ipc/registerIpc";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
let mainWindow: BrowserWindow | undefined;

// Keep the launcher alive on unexpected errors; a single failed IPC handler or
// background task should never take the whole window down.
process.on("uncaughtException", (error) => {
  console.error("[ChunkyPlay] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[ChunkyPlay] Unhandled rejection:", reason);
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "ChunkyPlay",
    backgroundColor: "#1a1d22",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  registerIpc(mainWindow);
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

void app.whenReady().then(async () => {
  await ensureBaseLayout();
  createWindow();
  if (!app.isPackaged) {
    return;
  }
  autoUpdater.autoDownload = false;
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    console.warn("Update check failed", error);
  });
});
