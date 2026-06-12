// Packaging pipeline for MonkeyPlay.
//
// electron-builder cannot embed the app icon into the .exe on this machine via
// its normal path: that requires the winCodeSign helper, whose macOS symlinks
// fail to extract without Windows symlink privilege. So we keep
// `signAndEditExecutable: false` (packaging succeeds, no winCodeSign), then set
// the icon directly with rcedit and rebuild the installer from the iconed app.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// 1. Compile main/preload/renderer.
run("pnpm exec electron-vite build");

// 2. Produce win-unpacked + installer (exe still has the default Electron icon).
run("pnpm exec electron-builder --win nsis");

// 3. Embed the MonkeyPlay icon into the app exe (no winCodeSign needed).
const rcedit = join("tools", "rcedit-x64.exe");
const exe = join("release", "win-unpacked", "MonkeyPlay.exe");
const icon = join("build", "icon.ico");
if (existsSync(rcedit) && existsSync(exe) && existsSync(icon)) {
  run(`"${rcedit}" "${exe}" --set-icon "${icon}"`);
  // 4. Rebuild the installer so it ships the iconed exe.
  run("pnpm exec electron-builder --win nsis --prepackaged release/win-unpacked");
} else {
  console.warn(`Skipping icon embed (missing rcedit/exe/icon): ${rcedit}, ${exe}, ${icon}`);
}

console.log("\n✓ Packaging complete:");
console.log("  release/win-unpacked/MonkeyPlay.exe");
console.log("  release/MonkeyPlay Setup 0.1.0.exe");
