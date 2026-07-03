# Human work needed

Everything else was done autonomously; these items need a human because they involve
accounts, credentials, money, or hardware this machine doesn't have.

## 1. Microsoft sign-in — Azure app registration (required for MS login)

The launcher's Microsoft device-code sign-in and authenticated launches are fully wired,
but they need *your* Azure application client id. The bundled fallback id will be rejected
by Microsoft.

1. Go to <https://portal.azure.com> → **Microsoft Entra ID** → **App registrations** → **New registration**.
   - Name: `MonkeyPlay`
   - Supported account types: **Personal Microsoft accounts only** (or "Accounts in any
     organizational directory and personal Microsoft accounts").
   - Redirect URI: leave empty (device-code flow doesn't need one).
2. In the new app: **Authentication → Advanced settings → Allow public client flows → Yes** → Save.
3. Copy the **Application (client) ID** and provide it to the launcher:
   - quick test: run with the env var `MONKEYPLAY_MS_CLIENT_ID=<your-client-id>`
   - permanent: replace the fallback in [app/src/main/auth/microsoftAuth.ts](app/src/main/auth/microsoftAuth.ts)
     (`minecraftClientId`).
4. **Apply for Minecraft API access.** Mojang gates third-party launcher access to
   `api.minecraftservices.com` (the `login_with_xbox` step) by client id. Fill in the
   official form: <https://help.minecraft.net/hc/en-us/articles/16254801392141>
   (search "Minecraft: Java Edition API" if the link moves). Sign-in returns 403 from the
   Minecraft services API until Mojang approves the client id.
5. Test: launcher → account chip (top right) → **Sign in with Microsoft**, then launch an
   instance with a Minecraft-owning account (must be able to join online-mode servers).

Offline accounts work today without any of this.

## 2. Build the companion HUD mod (needs a JDK)

This Mac has no Java, so the Fabric companion mod (FPS/CPS/ping/keystrokes HUD) jar could
not be rebuilt here. The launcher's "Install HUD" button needs the jar to exist.

```bash
# install a JDK 21 first (e.g. brew install --cask temurin@21)
cd companion-mod
./gradlew build        # produces build/libs/monkeyplay-companion-*.jar
```

The packaged app bundles that jar automatically (`extraResources` in app/package.json);
in dev the launcher picks it up straight from `companion-mod/build/libs/`.
Note: the mod currently targets Minecraft `~1.21.4` (see `fabric.mod.json`); bump
`gradle.properties` if you want it for newer versions.

## 3. Distribution polish (optional, costs money/accounts)

- **Code signing**: Windows builds are unsigned (`signAndEditExecutable: false`) and macOS
  builds are un-notarized. Buy a Windows code-signing cert / join the Apple Developer
  Program and configure electron-builder if you plan to distribute publicly.
- **Auto-updates**: `publish.url` in app/package.json points at the placeholder
  `https://updates.monkeyplay.local/`. Point it at real hosting (or switch the provider to
  `github` and cut GitHub releases).
- **Modrinth user agent**: settings default UA says `contact: local-dev`. Put a real
  contact email in there before heavy public use (Modrinth asks for one).

## 4. Real-hardware smoke test

The full launch path (downloads → Java provisioning → spawn) is exercised by tests and a
real-Electron boot check, but nobody has clicked LAUNCH into a real game world on this
machine. On a gaming PC: create a Fabric 1.21.4 instance → Mods → **Install pack** →
LAUNCH, and confirm you reach the title screen with Sodium active (Options → Video
Settings shows Sodium's menu), then try the quick-join field against a server.
