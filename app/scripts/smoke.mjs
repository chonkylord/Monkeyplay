// Renderer smoke test: serves the production renderer build, stubs the IPC
// bridge the preload normally exposes, and drives the real UI in Chromium.
// Validates the Lunar-style shell (titlebar, sidebar, hero) and that the core
// flows (create instance, launch progress, mods page, account menu, settings)
// wire through without runtime errors. Writes a screenshot to release/smoke.png.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";

const root = join(process.cwd(), "out", "renderer");
if (!existsSync(join(root, "index.html"))) {
  console.error("Renderer build missing — run `pnpm build` first.");
  process.exit(1);
}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? "/").split("?")[0];
    const file = join(root, url === "/" ? "index.html" : url.replace(/^\//, ""));
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const failures = [];
const pageErrors = [];
function check(label, condition) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures.push(label);
}

// Minimal in-memory fake of the main process, matching the preload surface.
const bridgeStub = `
window.monkeyplay = (() => {
  let instances = [];
  let accounts = [];
  let mods = [{ fileName: "sodium.jar", enabled: true, sizeBytes: 2048576 }, { fileName: "lithium.jar", enabled: false, sizeBytes: 512000 }];
  let launchListener = null;
  const noop = () => {};
  const emit = (event) => launchListener && launchListener(event);
  return {
    settings: {
      get: async () => ({ theme: "dark", concurrentDownloads: 4, defaultRamMb: 4096, defaultJvmArgs: ["-XX:+UseG1GC"], modrinthUserAgent: "x" }),
      update: async (u) => ({ theme: "dark", concurrentDownloads: 4, defaultRamMb: 4096, defaultJvmArgs: ["-XX:+UseG1GC"], modrinthUserAgent: "x", ...u })
    },
    instances: {
      list: async () => instances,
      create: async (input) => { const i = { id: "id" + instances.length, name: input.name, minecraftVersion: input.minecraftVersion, loader: input.loader, ramMb: 4096, jvmArgs: ["-XX:+UseG1GC"], gameDir: "/g", createdAt: "now", updatedAt: "now" }; instances.push(i); return i; },
      update: async (id, u) => { const i = instances.find(x => x.id === id); Object.assign(i, u); return i; },
      delete: async (id) => { instances = instances.filter(x => x.id !== id); }
    },
    launch: {
      start: async ({ instanceId }) => {
        emit({ id: "l1", instanceId, phase: "downloading-assets", message: "Downloading assets 50/100 (50%)", timestamp: new Date().toISOString(), progressPct: 50 });
        return { launchId: "l1", logPath: "/log" };
      },
      onEvent: (cb) => { launchListener = cb; return noop; }
    },
    accounts: {
      list: async () => accounts,
      createOffline: async (username) => { const a = { id: "acc-" + username, type: "offline", username, uuid: "u-" + username, active: true, createdAt: "now", lastUsedAt: "now" }; accounts = accounts.map(x => ({ ...x, active: false })).concat(a); return a; },
      setActive: async (id) => { accounts = accounts.map(x => ({ ...x, active: x.id === id })); return accounts; },
      delete: async (id) => { accounts = accounts.filter(x => x.id !== id); }
    },
    auth: { requestDeviceCode: async () => ({ userCode: "ABCD", deviceCode: "d", verificationUri: "https://x", expiresIn: 1, interval: 1, message: "m" }), completeDeviceCode: async () => ({ accountId: "a", username: "MsUser" }) },
    versions: { list: async () => ([{ id: "1.21.4", type: "release", releaseTime: "2024-12-03" }, { id: "1.20.4", type: "release", releaseTime: "2023-12-07" }, { id: "26w01a", type: "snapshot", releaseTime: "2026-01-01" }]) },
    news: { list: async () => ([
      { id: "n1", title: "Minecraft 1.99", version: "1.99", category: "release", date: "2026-06-30T00:00:00Z", shortText: "Big release." },
      { id: "n2", title: "Snapshot 26w20a", version: "26w20a", category: "snapshot", date: "2026-06-20T00:00:00Z", shortText: "Testing things." }
    ]) },
    modrinth: { search: async () => ([{ projectId: "p1", slug: "sodium", title: "Sodium", description: "Fast rendering", projectType: "mod", downloads: 1, author: "x" }]), install: async () => [] },
    mods: {
      list: async () => mods,
      setEnabled: async (_i, fileName, enabled) => { mods = mods.map(m => m.fileName === fileName ? { ...m, enabled } : m); },
      delete: async (_i, fileName) => { mods = mods.filter(m => m.fileName !== fileName); },
      installFpsBoost: async () => ([{ slug: "sodium", name: "Sodium", status: "installed" }, { slug: "iris", name: "Iris", status: "skipped", detail: "no build" }]),
      installCompanion: async () => "/g/mods/monkeyplay-companion.jar"
    },
    system: { java: async () => ([{ path: "/usr/bin/java", major: 21, source: "path" }]), totalMemoryMb: async () => 32768, openExternal: async () => noop, openPath: async () => noop, platform: "win32" },
    window: { minimize: async () => noop, toggleMaximize: async () => noop, close: async () => noop }
  };
})();
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1320, height: 880 } });
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") pageErrors.push(msg.text());
});
await page.addInitScript(bridgeStub);

try {
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 10000 });

  // Shell chrome.
  check("titlebar brand renders", (await page.locator(".titlebar-brand span").innerText()) === "MONKEYPLAY");
  check("custom window controls on win32", await page.locator(".titlebar-controls").isVisible());
  check("sidebar has 5 pages", (await page.locator(".side-item").count()) === 5);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`dark Lunar background (${bg})`, bg === "rgb(13, 17, 23)");

  // Home hero.
  check("hero visible", await page.locator("#hero").isVisible());
  check("launch button present", await page.locator("#launch").isVisible());
  check("launch disabled with no instances", await page.locator("#launch").isDisabled());
  await page.waitForSelector(".news-card");
  check("news strip renders stubbed items", (await page.locator(".news-card").count()) >= 2);

  // Create an instance from the Instances page.
  await page.click('.side-item:has-text("Instances")');
  await page.waitForSelector("#instances");
  await page.fill('input[aria-label="Instance name"]', "Smoke Fabric");
  await page.selectOption('select[aria-label="Minecraft version"]', "1.21.4");
  await page.selectOption('select[aria-label="Loader"]', "fabric");
  await page.click('.create-bar button[type="submit"]');
  await page.waitForSelector(".instance-card");
  check("created instance card appears", /Smoke Fabric/.test(await page.locator(".instance-card").first().innerText()));
  check("per-instance RAM slider present", await page.locator('.instance-card input[type="range"]').first().isVisible());
  check("quick-join server field on card", await page.locator(".server-control input").first().isVisible());

  // Launch from Home shows progress.
  await page.click('.side-item:has-text("Home")');
  await page.waitForSelector("#launch:not([disabled])");
  await page.click("#launch");
  await page.waitForSelector(".launch-status");
  check("launch progress appears", /50%/.test(await page.locator(".launch-status").innerText()));
  check("progress bar fills", await page.locator(".progress-fill").isVisible());

  // Mods page: feature cards, Modrinth search, installed list toggle.
  await page.click('.side-item:has-text("Mods")');
  await page.waitForSelector("#mods");
  check("performance pack card", await page.locator("#fps-boost").isVisible());
  check("HUD companion card", await page.locator("#hud").isVisible());
  await page.waitForSelector(".mod-row");
  check("installed mods listed", (await page.locator(".mod-row").count()) === 2);
  await page.click("#fps-boost .primary-button");
  await page.waitForSelector(".preset-status");
  check("preset install statuses render", (await page.locator(".preset-status li").count()) === 2);
  await page.fill('input[aria-label="Search Modrinth"]', "sodium");
  await page.click('#mods form.inline-form button[type="submit"]');
  await page.waitForSelector(".result-row");
  check("modrinth result renders", /Sodium/.test(await page.locator(".result-row").first().innerText()));

  // Account menu: add an offline account.
  await page.click(".account-chip");
  await page.waitForSelector(".account-dropdown");
  check("microsoft sign-in offered", await page.locator(".ms-signin").isVisible());
  await page.fill('input[aria-label="Offline username"]', "SmokeTester");
  await page.click('button[aria-label="Add offline account"]');
  await page.waitForFunction(() => document.querySelector(".account-chip")?.textContent?.includes("SmokeTester"));
  check("offline account becomes active", /SmokeTester/.test(await page.locator(".account-chip").innerText()));
  await page.keyboard.press("Escape");

  // News page.
  await page.click('.side-item:has-text("News")');
  await page.waitForSelector("#news");
  check("news page renders items", (await page.locator("#news .news-card").count()) === 2);

  // Settings page.
  await page.click('.side-item:has-text("Settings")');
  await page.waitForSelector("#settings");
  check("java runtime listed", /Java 21/.test(await page.locator(".java-list").innerText()));
  check("fair-play panel present", await page.locator(".boundary-panel").isVisible());

  check("no renderer runtime errors", pageErrors.length === 0);
  if (pageErrors.length) console.log("  errors:\n" + pageErrors.map((e) => "    - " + e).join("\n"));

  const shot = join(process.cwd(), "release", "smoke.png");
  await page.click('.side-item:has-text("Home")');
  await page.waitForSelector("#hero");
  await page.waitForTimeout(400); // let the sidebar hover/active fade settle
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`  screenshot: ${shot}`);
} catch (error) {
  failures.push(`exception: ${error?.message ?? error}`);
  console.error(error);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.log(`\nSMOKE FAILED (${failures.length}):\n` + failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log("\nSMOKE PASSED");
