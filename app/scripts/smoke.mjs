// Renderer smoke test: serves the production renderer build, stubs the IPC
// bridge the preload normally exposes, and drives the real UI in Chromium.
// Validates the Minecraft theme, that every panel renders, and that the core
// flows (create instance, RAM slider, add account, launch) wire through without
// runtime errors. Writes a screenshot to release/smoke.png.
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

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
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
window.chunkyplay = (() => {
  let instances = [];
  let accounts = [];
  const noop = () => {};
  return {
    settings: {
      get: async () => ({ theme: "dark", concurrentDownloads: 4, defaultRamMb: 4096, defaultJvmArgs: [], modrinthUserAgent: "x" }),
      update: async (u) => ({ theme: "dark", concurrentDownloads: 4, defaultRamMb: 4096, defaultJvmArgs: [], modrinthUserAgent: "x", ...u })
    },
    instances: {
      list: async () => instances,
      create: async (input) => { const i = { id: "id" + instances.length, name: input.name, minecraftVersion: input.minecraftVersion, loader: input.loader, ramMb: 4096, jvmArgs: ["-XX:+UseG1GC"], gameDir: "C:/g", createdAt: "now", updatedAt: "now" }; instances.push(i); return i; },
      update: async (id, u) => { const i = instances.find(x => x.id === id); Object.assign(i, u); return i; },
      delete: async (id) => { instances = instances.filter(x => x.id !== id); }
    },
    launch: { offline: async () => ({ launchId: "l", logPath: "x" }), onEvent: () => noop },
    accounts: {
      list: async () => accounts,
      createOffline: async (username) => { const a = { id: "acc-" + username, type: "offline", username, uuid: "u", active: true, createdAt: "now", lastUsedAt: "now" }; accounts = accounts.map(x => ({ ...x, active: false })).concat(a); return a; },
      setActive: async (id) => { accounts = accounts.map(x => ({ ...x, active: x.id === id })); return accounts; },
      delete: async (id) => { accounts = accounts.filter(x => x.id !== id); }
    },
    auth: { requestDeviceCode: async () => ({ userCode: "ABCD", deviceCode: "d", verificationUri: "https://x", expiresIn: 1, interval: 1, message: "m" }), completeDeviceCode: async () => ({ accountId: "a", username: "MsUser" }) },
    modrinth: { search: async () => ([{ projectId: "p1", slug: "sodium", title: "Sodium", description: "Fast rendering", projectType: "mod", downloads: 1, author: "x" }]), install: async () => [] },
    system: { java: async () => ([{ path: "C:/java", major: 21, source: "path" }]), totalMemoryMb: async () => 32768, openExternal: async () => noop }
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
  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell", { timeout: 10000 });

  check("brand mark renders 'ChunkyPlay'", (await page.locator(".brand-mark strong").innerText()) === "ChunkyPlay");
  check("instances panel visible", await page.locator("#instances").isVisible());
  check("mods panel visible", await page.locator("#mods").isVisible());
  check("accounts panel visible", await page.locator("#accounts").isVisible());
  check("settings panel visible", await page.locator("#settings").isVisible());
  check("launch button present", await page.locator("button.play-button").isVisible());

  const headFont = await page.locator(".brand-mark strong").evaluate((el) => getComputedStyle(el).fontFamily);
  check(`heading uses pixel font (${headFont})`, /Press Start 2P|VT323/i.test(headFont));
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`dark Minecraft background (${bg})`, bg === "rgb(21, 23, 28)");

  // Java runtime list populated from the (stubbed) system probe.
  check("detected Java runtime shown", /Java 21/.test(await page.locator(".java-list").innerText()));

  // Create instance flow.
  await page.fill('input[aria-label="Instance name"]', "Smoke Fabric");
  await page.selectOption('select[aria-label="Loader"]', "fabric");
  await page.click('#instances button[type="submit"]');
  await page.waitForSelector(".instance-card");
  check("created instance card appears", /Smoke Fabric/.test(await page.locator(".instance-card").first().innerText()));
  check("per-instance RAM slider present", await page.locator('.instance-card input[type="range"]').first().isVisible());

  // Modrinth search flow.
  await page.fill('input[aria-label="Search Modrinth"]', "sodium");
  await page.click('#mods button[type="submit"]');
  await page.waitForSelector(".result-row");
  check("modrinth result renders", /Sodium/.test(await page.locator(".result-row").first().innerText()));

  // Account flow.
  await page.fill('input[aria-label="Offline username"]', "SmokeTester");
  await page.click('#accounts button[type="submit"]');
  await page.waitForSelector(".account-row");
  check("offline account created", /SmokeTester/.test(await page.locator(".account-row").first().innerText()));

  check("no renderer runtime errors", pageErrors.length === 0);
  if (pageErrors.length) console.log("  errors:\n" + pageErrors.map((e) => "    - " + e).join("\n"));

  const shot = join(process.cwd(), "release", "smoke.png");
  await page.screenshot({ path: shot, fullPage: true });
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
