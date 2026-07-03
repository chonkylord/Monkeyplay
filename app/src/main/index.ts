import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureBaseLayout } from "./paths";
import { registerIpc } from "./ipc/registerIpc";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
let mainWindow: BrowserWindow | undefined;

/** Locate the app icon for the window/taskbar across packaged and dev runs. */
function resolveIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath, "icon.png"),
    join(__dirname, "../../build/icon.png"),
    join(app.getAppPath(), "build", "icon.png")
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

// Keep the launcher alive on unexpected errors; a single failed IPC handler or
// background task should never take the whole window down.
process.on("uncaughtException", (error) => {
  console.error("[MonkeyPlay] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[MonkeyPlay] Unhandled rejection:", reason);
});

function createWindow(): void {
  const icon = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: "MonkeyPlay",
    backgroundColor: "#0d1117",
    // Frameless chrome: macOS keeps its inset traffic lights, other platforms
    // get custom window controls rendered in the renderer titlebar.
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const } : { frame: false }),
    ...(icon ? { icon } : {}),
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
