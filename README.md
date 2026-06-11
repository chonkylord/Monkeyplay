# MonkeyPlay

MonkeyPlay is an Electron + React launcher scaffold for Minecraft: Java Edition, with a Fabric companion mod project.

## Development

```powershell
pnpm -C app install
pnpm -C app dev
```

## Checks

```powershell
pnpm -C app typecheck
pnpm -C app lint
pnpm -C app test
cd companion-mod
.\gradlew.bat build
```

## Packaging

```powershell
pnpm -C app package
```

The launcher stores runtime data under the OS app-data directory by default. For tests or local isolation, set `MONKEYPLAY_DATA_DIR`.

## Boundaries

MonkeyPlay does not include aim assist, triggerbots, auto-clickers, X-ray, ESP, reach changes, velocity changes, packet manipulation, or anticheat evasion. The companion mod's hitbox toggle is limited to Minecraft's own vanilla hitbox renderer flag.

