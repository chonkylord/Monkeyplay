# ChunkyPlay Build Log

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
  - Fabric mod id `chunkyplay-companion`.
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
  - Playwright Electron smoke test against source app passed: title `ChunkyPlay`, visible brand count `1`.
  - Playwright Electron smoke test against packaged `app/release/win-unpacked/ChunkyPlay.exe` passed: title `ChunkyPlay`, visible brand count `1`, no console/page errors.
  - Windows installer produced: `app/release/ChunkyPlay Setup 0.1.0.exe` (`84,325,984` bytes).
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
- Packaging: `extract-zip` is loaded via `createRequire` (consistent with `electron-updater`) to avoid an ESM/CJS preparse crash on raw `out/` launches. Companion mod rebuilt via `gradlew.bat build` (boundary test passing) and re-bundled. Repackaged installer + `win-unpacked` produced; packaged `ChunkyPlay.exe` launches clean (exit 0, no stderr).
