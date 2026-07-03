# MonkeyPlay Build Log

## 2026-07-03 — Lunar-style client overhaul (macOS session)

- **UI rebuilt in a Lunar Client style**: frameless window (native traffic lights on
  macOS via `hiddenInset`, custom minimize/maximize/close elsewhere), icon sidebar with
  five pages (Home / Instances / Mods / News / Settings), top-right account chip with
  mc-heads avatars, and a home hero with instance dropdown, big LAUNCH button, quick-join
  field, and a live progress bar. Pixel fonts/Google Fonts removed (system font stack —
  fully offline-capable renderer).
- **Launch core**: unified `launch()` replaces `launchOffline` — an active Microsoft
  account launches authenticated via silent refresh-token renewal (`refreshMinecraftSession`:
  refresh grant → XBL → XSTS → login_with_xbox → profile, refresh token re-stored via
  safeStorage); everyone else launches offline. `LaunchEvent` gained `progressPct`;
  library downloads now report progress like assets.
- **Quick join**: `serverAddress` per instance + per-launch override. Modern versions get
  the feature-gated `--quickPlayMultiplayer` argument (detected from the version JSON's
  rules), pre-1.20 falls back to `--server/--port`.
- **Version picker**: `versions:list` IPC serves the (5-min-cached) Mojang manifest;
  Instances page offers releases with an opt-in snapshots toggle.
- **Mod manager** (`mods/modService.ts`): list/toggle (`.jar` ↔ `.jar.disabled`)/delete
  jars per instance; path-traversal guarded. **Performance pack**: one click installs
  Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast, Krypton, Dynamic FPS,
  ModernFix, Iris from Modrinth (all slugs verified against the API; per-mod failures are
  reported as "skipped", not fatal). **Install HUD** copies the bundled companion jar and
  pulls fabric-api.
- **News**: `news:list` IPC maps `launchercontent.mojang.com/v2/javaPatchNotes.json`
  (10-min cache) into home-strip and News-page cards.
- **Fixed** a renderer freeze the new smoke test caught: `loadMods` was recreated on every
  store change, so the ModsPage effect re-ran forever; page callbacks now use
  `useLauncherStore.getState()` for stable identities.
- **Checks (all passing on macOS)**: typecheck, lint, vitest 22 tests (quick-join arg
  building, news mapping, mod toggle fs behavior, preset dedupe + existing suites),
  24-point Playwright renderer smoke (`release/smoke.png`), and a real-Electron boot
  check — window opens, IPC round-trips, live manifest fetch returned 900 versions
  (`release/electron-smoke.png`). Note: in VSCode-extension shells `ELECTRON_RUN_AS_NODE`
  must be unset or Electron runs as plain Node.
- **Not done here** (see `humanwork.md`): Azure client id + Mojang API approval for
  Microsoft sign-in, companion-mod Gradle build (no JDK on this Mac), code
  signing/notarization, real update-feed URL, real-hardware launch test.

## 2026-06-11

### M0 - Environment Bring-Up
- Workspace initially contained only `EXECUTION.md`.
- Toolchain check:
  - Node: `v25.8.2`
  - npm: `11.11.1`
  - Git: `2.53.0.windows.2`
  - Java: Microsoft OpenJDK `25+36-LTS`
  - `pnpm` was missing and was installed with `npm install -g pnpm`; installed version is `11.5.3`.
  - `gradle` was not available globally, so the companion mod needs a checked-in Gradle wrapper.
- Boundary note: no forbidden gameplay features from sections 3 or 6 are in scope for implementation.

### M0 - Scaffold, Build, and Package
- Created the monorepo layout from `EXECUTION.md`:
  - `app/`: Electron + React + Vite + strict TypeScript launcher.
  - `shared/`: shared launcher/account/instance/mod/runtime types.
  - `companion-mod/`: Fabric/Loom Java mod project.
- Launcher implemented:
  - Sandboxed renderer with `contextIsolation: true`, `nodeIntegration: false`, and typed IPC through preload.
  - Dashboard, instance grid, account panel, Modrinth search/install surface, settings, and launch-log panel.
  - Instance CRUD with isolated game directories.
  - Offline account creation and deterministic offline UUID generation.
  - Microsoft device-code auth flow scaffolding with refresh-token persistence via Electron `safeStorage`.
  - Mojang manifest/version/client/library/native/asset download code with SHA-1 verification.
  - Java runtime detection and version-major selection policy.
  - Offline vanilla launch command assembly and process/log streaming.
  - Modrinth search/install dependency walk for required dependencies.
  - electron-builder NSIS packaging and electron-updater configuration stub.
- Companion mod implemented:
  - Fabric mod id `monkeyplay-companion`.
  - Boundary header in source.
  - Hitbox toggle uses only `client.getEntityRenderDispatcher().setRenderHitboxes(hitboxesEnabled)`.
  - HUD overlay uses local FPS, CPS, ping, coordinates/facing, keystrokes, and own successful-hit count.
  - Toggle sprint/sneak convenience keys.
  - JUnit boundary test checks the hitbox implementation and rejects obvious forbidden rendering/packet/velocity APIs.
- Packaging fix:
  - Initial `pnpm -C app package` failed extracting electron-builder's Windows signing helper because this shell lacks symlink privilege.
  - Fixed local unsigned build by setting `win.signAndEditExecutable=false`; packaging then succeeded.
- Runtime fixes after first manual launch screenshot:
  - Fixed `electron-updater` CommonJS runtime import by loading it with `createRequire`.
  - Fixed preload output/path mismatch by emitting the sandboxed preload as CommonJS `out/preload/index.js`.
- Passing checks:
  - `pnpm -C app typecheck` passed.
  - `pnpm -C app lint` passed.
  - `pnpm -C app test` passed: 1 test file, 4 tests.
  - `pnpm -C app build` passed.
  - `.\gradlew.bat build` in `companion-mod/` passed.
  - Playwright Electron smoke test against source app passed: title `MonkeyPlay`, visible brand count `1`.
  - Playwright Electron smoke test against packaged `app/release/win-unpacked/MonkeyPlay.exe` passed: title `MonkeyPlay`, visible brand count `1`, no console/page errors.
  - Windows installer produced: `app/release/MonkeyPlay Setup 0.1.0.exe` (`84,325,984` bytes).
- Gate status:
  - M0 is passing locally.
  - M1-M9 are not fully gate-verified. The code contains meaningful slices for launch core, accounts, instances, Modrinth, companion mod, and packaging, but the spec's later gates require live Minecraft title-screen launches, real Microsoft sign-in, loader-specific launches, in-world screenshots, shader/FPS validation, and update-feed validation.

### Polish pass - functionality, theme, self-debug, smoke test
- Launch core / "mods actually work":
  - Added `launch-core/loaders.ts`: Fabric and Quilt loader profiles are now fetched from their meta APIs, merged onto the resolved vanilla version (mainClass + Maven libraries + extra JVM/game args), so modded instances launch with their loader (and the mods installed into `mods/`). Forge/NeoForge throw an actionable "not yet auto-installed" error instead of silently launching vanilla.
  - Fixed `download.ts`: files without a known SHA-1 (e.g. loader Maven jars) were skipped even when absent; now downloaded when missing, hash-verified when a hash exists.
- RAM limits:
  - `arguments.ts` now emits `-Xms` (clamped to `<= -Xmx`) alongside `-Xmx${ramMb}M`.
  - Per-instance memory is editable from each instance card via a slider bounded by detected system RAM (`system:totalMemoryMb` IPC).
- Self-debugging:
  - Added `launch-core/diagnostics.ts` mapping failures to stable codes + remediation (CP-JAVA-001, CP-LOADER-002, CP-VERSION-003, CP-NET-004, CP-HASH-005, CP-DISK-006, CP-UNKNOWN-000). `launchService` wraps the whole flow and emits a coded `failed` event + log line; the renderer surfaces it. Added `uncaughtException`/`unhandledRejection` handlers in main so a single failure no longer kills the window.
- UI wiring: instance delete, per-instance RAM, account switch/delete, and Microsoft device-code sign-in are all wired through the store/preload/IPC; error banner is dismissable and a notice banner drives the sign-in flow.
- Theme: full Minecraft-GUI restyle (Press Start 2P / VT323 pixel fonts, dark stone background, beveled blocky panels/buttons, grass-green accents, pixel RAM slider).
- Checks: `typecheck`, `lint`, and `vitest` (11 tests, incl. new loader/diagnostics/Xms cases) pass. New `scripts/smoke.mjs` serves the production renderer and drives it in Chromium with a stubbed IPC bridge — 14 checks pass (theme, all panels, create-instance, RAM slider, Modrinth search, account create, zero runtime errors) and writes `release/smoke.png`.
- Packaging: `extract-zip` is loaded via `createRequire` (consistent with `electron-updater`) to avoid an ESM/CJS preparse crash on raw `out/` launches. Companion mod rebuilt via `gradlew.bat build` (boundary test passing) and re-bundled. Repackaged installer + `win-unpacked` produced; packaged `MonkeyPlay.exe` launches clean (exit 0, no stderr).

### Distribution pass — rename, icon, JRE, asset reliability
- Full rename ChunkyPlay → MonkeyPlay: app/product name, window title, UI brand, appId (`play.monkey.launcher`), `window.monkeyplay` bridge, User-Agent strings, env vars (`MONKEYPLAY_DATA_DIR` / `MONKEYPLAY_MS_CLIENT_ID`). Companion mod restructured to package `play.monkey.companion` (files moved + renamed `MonkeyPlay*`), mod id `monkeyplay-companion`; rebuilt with boundary test passing.
- Accounts simplified to offline-only per product decision: Microsoft sign-in button removed from the UI (backend left intact). `microsoftAuth.requestDeviceCode` now validates the response and throws an actionable message instead of crashing on an undefined `verification_uri`; added diagnostics code CP-AUTH-007.
- Java auto-provisioning: `java/temurin.ts` downloads + extracts the correct Eclipse Temurin JRE (8/17/21, OS/arch-aware) under the runtimes dir when no suitable Java is installed; `selectJavaRuntime` falls back to it with status reporting. Adoptium endpoints verified to resolve to real binaries.
- Asset download reliability: `downloadAssets` now runs with bounded concurrency (12) and reports progress (`Downloading assets N/total (pct%)`) so the launch log shows movement instead of appearing frozen on a fresh install; `downloadFile` fetches now use a 60s `AbortSignal.timeout` so a stalled connection can't hang the launch forever.
- Monkey icon: `scripts/make-icon.mjs` renders an SVG monkey in Chromium at 6 sizes into `build/icon.ico` (+ `build/icon.png`, renderer `assets/monkey.png` used as favicon and brand mark).
- Icon embedding workaround: electron-builder's exe-icon step needs winCodeSign, whose macOS symlinks fail to extract without Windows symlink privilege. So `signAndEditExecutable: false` is kept, and `scripts/package.mjs` runs the pipeline build → electron-builder → `rcedit --set-icon` on the exe → electron-builder `--prepackaged` to rebuild the installer from the iconed app. Verified the embedded exe icon is the monkey via `Icon.ExtractAssociatedIcon`. NOTE: electron-builder reads config from `package.json` ("build" field), not `electron-builder.yml`, on this project.
- Checks: typecheck, lint, 11 vitest tests, 14-point renderer smoke all pass; packaged `MonkeyPlay.exe` launches clean. Distributables: `release/MonkeyPlay Setup 0.1.0.exe` + `release/win-unpacked/` + `release/INSTALL - READ ME.txt`.
