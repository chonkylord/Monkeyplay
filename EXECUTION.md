# ChunkyPlay — Autonomous Build & Execution Specification

**Document version:** 1.0
**Target executor:** an autonomous coding agent (build + run + debug + package, end-to-end)
**Platform target:** Windows 11 first, then macOS + Linux
**Status:** ready to execute

---

## 0. How to use this document

This file is the complete spec for building **ChunkyPlay**, a Minecraft: Java Edition
launcher. Hand the agent the kickoff prompt below; it then reads this whole file and
works autonomously through the milestones, self-verifying at each gate.

### Kickoff prompt (paste this to the building agent)

> Read `chunkyplay/EXECUTION.md` in full. Build ChunkyPlay exactly to that spec,
> working milestone by milestone (M0 → M9). After each milestone, run its acceptance
> checks and do not advance until they pass. Use the autonomous build/debug loop in
> §9. Keep a running progress log in `chunkyplay/BUILD_LOG.md`. Do not add any feature
> outside the scope in §2, and obey the hard boundaries in §3 — if a feature would
> require crossing one of those lines, stop and leave it unbuilt. When all milestones
> pass the Definition of Done in §11, produce a packaged installer and a short summary.

---

## 1. Mission

ChunkyPlay is a polished, installable launcher for Minecraft: Java Edition that
competes with Lunar Client / Badlion / Prism on the things that matter: fast startup,
clean instance management, first-class mod-loader and shader support, and a tasteful
in-game HUD tuned for PVP players. It is a single distributable application.

It is **not** a cheat client. It contains no aimbot, no X-ray, no ESP, no automation of
combat. The "PVP" angle is performance and information that the vanilla game already
exposes — presented well.

---

## 2. Scope (what to build)

**Launcher application**
- Microsoft / Mojang account login (official OAuth device-code flow) with multi-account
  switching and secure token storage.
- Version management: pull Mojang's version manifest; download client jar, libraries,
  natives, and assets; verify by SHA-1; cache and de-duplicate shared files.
- Instances: isolated, named profiles (own mods/config/saves/resourcepacks), each pinned
  to a Minecraft version + loader + Java runtime + RAM allocation + JVM args.
- Java runtime management: detect installed JDKs and/or download a bundled JRE
  (Adoptium/Temurin) appropriate to the version (Java 8/17/21).
- Mod loaders: install and launch **Fabric, Quilt, Forge, NeoForge**.
- Shaders: install and enable **Iris**; manage shaderpacks.
- Performance pack: one-click install of **Sodium + Lithium** (+ optional FerriteCore,
  EntityCulling) from Modrinth.
- Mod browser: search/install/update mods and shaderpacks via the **Modrinth API**;
  resolve dependencies; per-instance enable/disable.
- ChunkyPlay Companion mod (see §6): ships the hitbox toggle + HUD overlays.
- UI: dashboard, instance grid, per-instance settings, mod browser, account manager,
  logs viewer, settings. Custom themeable design.
- Auto-update for the launcher itself.
- Packaged installers per OS.

**ChunkyPlay Companion (Fabric mod)** — see §6 for the exact, bounded feature list.

---

## 3. Hard boundaries (NON-NEGOTIABLE — the building agent must enforce these)

These exist because the easy "improvement" of each scoped feature is a cheat. Do not
cross them. If a requested or "obvious next" change requires any of the following, leave
it unbuilt and note it in `BUILD_LOG.md`.

1. **Hitboxes are depth-tested only.** Implement the hitbox toggle by flipping
   Minecraft's *own* hitbox renderer (`EntityRenderDispatcher#setRenderHitboxes`). Do
   **not** write a custom renderer, do **not** disable depth testing, do **not** render
   entities/boxes/names/health/tracers through walls. Behind a block, a hitbox must be
   invisible — exactly like vanilla `F3+B`.
2. **No targeting assistance of any kind.** No aimbot, aim assist, "smooth aim,"
   triggerbot, auto-clicker, kill aura, or any code that reads another entity's position
   to move the camera or to time/automate clicks or packets.
3. **No X-ray / ore-finder / cave-finder.** A brightness/gamma slider ("fullbright") is
   allowed because it only brightens; making blocks transparent to reveal ores is not.
4. **No combat/movement exploits.** No reach extension, no no-knockback/velocity, no
   fast-place/fast-break beyond vanilla, no auto-sprint-reset / W-tap automation, no
   packet manipulation. Toggle-sprint and toggle-sneak (hold-state convenience) are the
   *only* input conveniences allowed, and they must not automate any combat timing.
5. **Read-only game state for the HUD.** HUD widgets may display information the vanilla
   client already has (your FPS, your coords, your clicks, tab-list ping). They must not
   derive hidden information about other players or the world.
6. **No detection evasion.** Do not obfuscate the client, spoof the brand/version string
   to hide ChunkyPlay, randomize signatures, or otherwise try to defeat server anticheat.
   The companion mod registers under its real id.

If the original request reappears (X-ray, auto-aim, auto-hit, ESP) — it is out of scope.
Build the legitimate launcher; do not build those.

---

## 4. Tech stack (decided — do not re-litigate)

The user does not care about the stack, so it is fixed here for a reliable autonomous
build. Swap only if a hard blocker appears, and record why in `BUILD_LOG.md`.

| Layer | Choice | Why |
|---|---|---|
| App shell | **Electron** | Largest ecosystem + reference material → most reliable autonomous build/debug; trivial to spawn the Java process; mature packaging. |
| Language | **TypeScript** (strict) | Type safety across UI + launch core. |
| UI | **React + Vite** | Fast HMR dev loop; component model fits the views. |
| State | **Zustand** (or Redux Toolkit) | Simple store for instances/accounts/settings. |
| Styling | **Tailwind CSS** + a small component layer | Fast, themeable. |
| Launch core | **Node/TS in the Electron main process** | Owns downloads, auth, JVM spawn. |
| Packaging | **electron-builder** | NSIS (Win), dmg (mac), AppImage/deb (Linux). |
| Updates | **electron-updater** | Self-update channel. |
| Companion mod | **Java 21 + Fabric API + Fabric Loom (Gradle)** | Fabric is the simplest loader to target for the HUD/hitbox toggle. |
| Tests | **Vitest** (TS) + **JUnit** (mod) + **Playwright** (E2E on the renderer) | Self-verifiable gates. |
| Package manager | **pnpm** | Fast, deterministic. |

Project root is this folder: `chunkyplay/`.

---

## 5. Architecture

```
chunkyplay/
├─ EXECUTION.md            ← this file
├─ BUILD_LOG.md            ← agent writes progress here
├─ app/                    ← Electron launcher
│  ├─ src/
│  │  ├─ main/             ← main process
│  │  │  ├─ launch-core/   ← manifests, downloads, loaders, jvm, spawn
│  │  │  ├─ auth/          ← Microsoft OAuth device-code flow + token store
│  │  │  ├─ instances/     ← instance CRUD + storage layout
│  │  │  ├─ modrinth/      ← mod/shader browser API client
│  │  │  ├─ java/          ← JRE detect/download
│  │  │  └─ ipc/           ← typed IPC handlers
│  │  ├─ preload/          ← contextBridge-exposed typed API
│  │  └─ renderer/         ← React UI (views, components, store)
│  ├─ electron-builder.yml
│  ├─ package.json
│  └─ vite.config.ts
├─ companion-mod/          ← ChunkyPlay Companion (Fabric, Java 21)
│  ├─ src/main/java/play/chunky/companion/
│  ├─ src/main/resources/  ← fabric.mod.json, mixins, assets
│  └─ build.gradle
└─ shared/                 ← TS types shared between main/renderer
```

**Process model.** Renderer is sandboxed (`contextIsolation: true`, `nodeIntegration:
false`). It talks to the main process only through a typed `preload` bridge over IPC.
The main process owns all filesystem, network, auth, and child-process work.

**On-disk data layout** (per OS app-data dir, e.g. `%APPDATA%/ChunkyPlay/`):
```
ChunkyPlay/
├─ accounts.json            ← non-secret account metadata (tokens go in OS keychain)
├─ settings.json
├─ instances/<name>/        ← .minecraft per instance (mods, config, saves, …)
├─ shared/                  ← de-duplicated assets, libraries, version jsons
│  ├─ assets/  libraries/  versions/  natives/
├─ runtimes/                ← downloaded Temurin JREs (8/17/21)
└─ logs/
```

**Secrets.** Refresh/access tokens are stored via the OS credential store
(`keytar` or Electron `safeStorage`), never in plaintext JSON.

---

## 6. ChunkyPlay Companion mod — exact feature spec

A Fabric mod (id `chunkyplay-companion`) the launcher installs into Fabric/Quilt
instances. It is the *only* place in-game behavior is added. Everything here is
read-only display or vanilla-equivalent, per §3.

**6.1 Hitbox toggle**
- A configurable keybind (default unbound; user sets it) and an in-menu toggle.
- Implementation: set the value behind `MinecraftClient`'s
  `EntityRenderDispatcher#setRenderHitboxes(boolean)` — i.e. flip the same flag `F3+B`
  flips. Nothing else. This guarantees depth testing and terrain occlusion for free.
- It must behave identically to vanilla `F3+B` (boxes + the vanilla look-vector line are
  acceptable because they are vanilla). No through-wall rendering.

**6.2 HUD overlays** (via `HudRenderCallback`, each individually toggleable + movable)
- FPS, configurable position/format.
- CPS (clicks-per-second) for left/right mouse — count this client's own click events.
- Ping — read from the local tab-list `PlayerListEntry#getLatency()`.
- Coordinates / facing — same data as `F3` (your own position).
- Keystroke display — WASD + mouse + space, reflecting this client's input states.
- Combo/hit counter is allowed **only** as a count of your own successful attacks already
  reported by the vanilla client; it must not predict or assist anything.

**6.3 Input convenience** (the only allowed input features)
- Toggle-sprint and toggle-sneak: flip a held-state flag fed into movement input.
- Must not auto-reset sprint, auto-W-tap, or otherwise automate combat timing.

**6.4 Visual/quality**
- Brightness/gamma slider ("fullbright") — brightens only; never makes blocks transparent.
- Crosshair customization (color/shape/scale) — cosmetic overlay only.
- FPS cap / VSync passthrough to vanilla options.

**Explicitly forbidden in the mod** (restating §3 at the code site): aim assist,
triggerbot/auto-clicker, reach changes, velocity/no-knockback, X-ray, through-wall
rendering of anything, packet manipulation, brand/signature spoofing.

The mod's source must carry a header comment stating these boundaries so future edits
don't erode them.

---

## 7. Launch pipeline (the core algorithm)

Implement in `app/src/main/launch-core/`. Given an instance:

1. **Resolve version JSON.** Fetch `version_manifest_v2.json`; pick the version entry;
   download its per-version JSON; verify SHA-1.
2. **Apply loader.** If Fabric/Quilt: fetch the loader profile from the loader's meta API
   and merge its libraries + main class. If Forge/NeoForge: run the loader installer (or
   consume its install profile) to produce the modified version JSON + libraries.
3. **Download libraries + natives.** Resolve each library's rule set for the current OS;
   download jars; extract natives to the instance's natives dir; verify SHA-1.
4. **Download assets.** Fetch the asset index; download objects into `shared/assets`
   by hash; build/refresh the virtual/legacy assets if the version needs it.
5. **Provision Java.** Choose the right major version (8 for ≤1.16-ish, 17 for 1.17–1.20.4,
   21 for 1.20.5+/1.21+). Use a detected JDK or download Temurin into `runtimes/`.
6. **Build classpath + arguments.** Compose `-cp`, JVM args (memory, GC, `-Djava.library.path`,
   log config), Minecraft args (auth, version, asset index, game/asset dirs), and any
   loader-injected args. Substitute the auth token from §8.
7. **Spawn.** Launch the JVM as a child process with the instance's game directory as cwd;
   stream stdout/stderr to the logs viewer and `logs/`; surface exit codes and crash
   reports in the UI.
8. **Offline/dev launch mode.** Support launching with a generated offline UUID + chosen
   username (no real auth). Single-player and LAN work in this mode — this is the primary
   autonomous-test path (§9/§10), since it needs no credentials or live servers.

---

## 8. Authentication (Microsoft OAuth, device-code flow)

Use the public Microsoft identity + Xbox Live + Minecraft services chain:
1. Device-code request → show user a code + URL; poll the token endpoint.
2. MSA access token → Xbox Live (`XBL`) → XSTS token.
3. XSTS → Minecraft `authenticate` → Minecraft access token + profile (UUID, name).
4. Verify game ownership / fetch profile.
5. Store the refresh token in the OS keychain; refresh access tokens silently on launch.

Provide clear UI for "device code" sign-in and account switching. Never log tokens.
Offline/dev accounts (§7.8) bypass this for testing only and are clearly labeled.

---

## 9. The autonomous build / debug loop

Work in this loop for every milestone. The point is that the agent self-verifies and
iterates without a human in the loop until the gate passes.

**Environment bring-up (M0):**
- Verify/install: Node LTS, pnpm, Git, JDK 21 (for building the mod), and JDK 17 + 8
  available or downloadable for runtime tests.
- `pnpm install` at `app/`; `./gradlew --version` at `companion-mod/`.

**Per-milestone loop:**
1. Implement the milestone's slice.
2. **Typecheck + lint:** `pnpm -C app typecheck && pnpm -C app lint`.
3. **Unit/integration tests:** `pnpm -C app test` (Vitest) and, for the mod,
   `./gradlew test` in `companion-mod/`.
4. **Run it:** `pnpm -C app dev` (Electron + Vite HMR). Read the main-process logs and the
   renderer DevTools console. For launch-pipeline milestones, trigger an **offline-mode
   launch** and parse the game log.
5. **E2E (renderer):** Playwright drives the UI for the milestone's flow.
6. **Read the evidence, then fix.** Inspect logs/test output; diagnose root cause; patch;
   re-run from step 2. Do not advance until the milestone's acceptance checks pass.
7. Append a dated entry to `BUILD_LOG.md`: what was built, what failed, how it was fixed,
   and the passing check output.

**Debugging aids to rely on:** Electron main logs, renderer DevTools, the streamed
Minecraft log (grep for loader/Sodium/Iris/companion load lines and stack traces),
Gradle/Loom build output, and `electron-builder` packaging logs.

**Common failure classes to expect and handle:** wrong Java major version for the MC
version; missing/!extracted natives; classpath ordering with loaders; asset index
legacy/virtual handling; macOS `-XstartOnFirstThread`; SHA-1 mismatches (re-download);
sandbox/IPC mistakes (renderer trying to touch fs directly).

---

## 10. Milestones (build in order; each has an acceptance gate)

**M0 — Scaffold & tooling.** Monorepo layout per §5; Electron+Vite+React+TS strict
boots to an empty themed window; pnpm scripts (`dev`, `build`, `typecheck`, `lint`,
`test`, `package`); Gradle/Loom skeleton for the mod builds an empty jar.
*Gate:* `pnpm dev` opens a window; `./gradlew build` produces a jar; CI scripts run green.

**M1 — Launch core (vanilla, offline).** Implement §7 steps 1,3,4,6,7,8 for vanilla
versions. Provision Java (§7.5).
*Gate:* From the app, offline-launch a recent vanilla version to the title screen; log
shows asset/library resolution and a clean start; exit code surfaced in UI.

**M2 — Accounts.** Microsoft device-code flow (§8), keychain token storage, multi-account
switching; offline/dev accounts.
*Gate:* Sign in with a real MS account (user-provided at this step), token persists across
restart, silent refresh works; offline account still launches.

**M3 — Instances.** Instance CRUD, isolated dirs (§5), per-instance version/RAM/JVM args;
shared-cache de-duplication.
*Gate:* Two instances on different versions launch independently; deleting one leaves the
other intact; shared assets aren't duplicated on disk.

**M4 — Mod loaders.** Install + launch Fabric, Quilt, Forge, NeoForge (§7.2).
*Gate:* One instance per loader offline-launches to the title screen with the loader's
brand visible in the log.

**M5 — Companion mod.** Build §6 (hitbox toggle + HUD + allowed input conveniences);
launcher auto-installs it into Fabric/Quilt instances.
*Gate:* In an offline single-player world: HUD widgets render and are movable/toggleable;
hitbox keybind toggles vanilla hitboxes on a spawned mob; **stepping behind a wall hides
the hitbox** (depth test verified, by screenshot). No forbidden behavior present (code
review against §3/§6).

**M6 — Performance + shaders.** One-click Sodium+Lithium install; Iris install +
shaderpack management; brightness slider and crosshair in the companion mod.
*Gate:* Fabric instance offline-launches with Sodium+Iris loaded (log lines present); a
shaderpack enables; FPS overlay shows a higher number than vanilla baseline on the same
scene (screenshot/log evidence).

**M7 — Mod browser.** Modrinth search/install/update with dependency resolution; per-
instance enable/disable.
*Gate:* Search → install a mod + its dependency → it loads in-game; disable removes it
from the next launch.

**M8 — UX polish + logs + settings.** Dashboard, instance grid, settings, in-app log
viewer, error/crash surfacing, theming, empty/loading/error states.
*Gate:* Playwright E2E covers create-instance → install-loader → install-mod → launch;
crash reports render readably; no unhandled renderer/main exceptions in a full session.

**M9 — Packaging + auto-update.** electron-builder targets (NSIS first, then dmg +
AppImage/deb); electron-updater channel; code-signing hooks left configurable.
*Gate:* A clean Windows install via the produced installer launches the app, runs a game
instance, and an update bump is picked up by the updater on a test feed.

---

## 11. Definition of Done

- All milestone gates M0–M9 pass; `BUILD_LOG.md` shows the passing evidence.
- `pnpm -C app typecheck && lint && test` and `./gradlew build test` are green.
- A Windows installer exists; installing it on a clean profile yields a working app that
  can: sign in, create instances across all four loaders, install Sodium+Iris+a Modrinth
  mod, launch to gameplay, and show the companion HUD + depth-tested hitbox toggle.
- Code reviewed against §3 and §6: **none** of the forbidden behaviors are present, and
  the hitbox feature is implemented solely by toggling Minecraft's own renderer.
- README with build/run/package instructions; LICENSE; the companion mod source carries
  the boundary header comment.

---

## 12. Notes for the building agent

- Respect upstream API rate limits (Modrinth, Mojang, Microsoft); cache and back off.
- Verify every download by SHA-1; re-download on mismatch.
- Keep the renderer sandboxed; all privileged work goes through typed IPC.
- Prefer offline-mode launches for autonomous verification; only M2's gate needs a real
  account, which the user supplies at that step.
- If any task seems to call for one of the §3 forbidden behaviors, that's a signal you've
  left scope — stop, leave it unbuilt, and log it. Build the launcher, not a cheat.
