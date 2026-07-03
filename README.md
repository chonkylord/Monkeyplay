# MonkeyPlay

MonkeyPlay is a Lunar-style Minecraft: Java Edition client — an Electron + React launcher
with a Fabric companion mod. Dark, fast, one big green LAUNCH button.

## Features

- **One-click launch** with live phase progress (assets/libraries download %, Java provisioning).
- **Accounts**: Microsoft sign-in (device code, silent refresh-token renewal at launch) and
  offline accounts, switchable from the top-right account chip. See `humanwork.md` for the
  one-time Azure client-id setup Microsoft requires.
- **Instances**: version picker fed by the live Mojang manifest (releases + snapshots),
  vanilla/Fabric/Quilt auto-install, per-instance RAM slider and auto-join server.
- **Performance pack**: one click installs the community optimization stack (Sodium,
  Lithium, FerriteCore, Entity Culling, ImmediatelyFast, Krypton, Dynamic FPS, ModernFix,
  Iris shaders) from Modrinth.
- **Mod manager**: browse/install Modrinth mods & shaders, toggle installed jars on/off,
  delete them.
- **MonkeyPlay HUD** companion mod: FPS, CPS, ping, coordinates, keystrokes overlay.
- **Quick join**: type a server address on the home screen and the game connects on boot
  (`--quickPlayMultiplayer` on 1.20+, `--server/--port` on older versions).
- **News**: official Minecraft patch notes on the home screen and News page.
- Java auto-provisioning (Temurin 8/17/21) when no suitable JDK is installed.

## Development

```bash
pnpm -C app install
pnpm -C app dev
```

If your shell runs inside a VSCode/Electron extension host, unset `ELECTRON_RUN_AS_NODE`
before `pnpm dev`, or Electron starts as plain Node.

## Checks

```bash
pnpm -C app typecheck
pnpm -C app lint
pnpm -C app test
pnpm -C app build && node app/scripts/smoke.mjs   # renderer smoke (run from app/)
cd companion-mod && ./gradlew build                # needs JDK 21
```

## Packaging

```bash
pnpm -C app package
```

The launcher stores runtime data under the OS app-data directory by default. For tests or
local isolation, set `MONKEYPLAY_DATA_DIR`.

## Boundaries

MonkeyPlay does not include aim assist, triggerbots, auto-clickers, X-ray, ESP, reach
changes, velocity changes, packet manipulation, or anticheat evasion. The companion mod's
hitbox toggle is limited to Minecraft's own vanilla hitbox renderer flag, and the HUD
shows only local, vanilla-visible client state.
