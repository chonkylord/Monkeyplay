import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { InstanceProfile } from "@shared/types";
import { buildLaunchArguments, parseServerAddress, supportsQuickPlay } from "../main/launch-core/arguments";
import type { VersionJson } from "../main/launch-core/mojang";
import { mapPatchNotes } from "../main/news/newsService";

// modService pulls in electron (companion-jar lookup) through its import
// chain; stub the pieces the pure fs helpers never touch.
vi.mock("electron", () => ({
  app: { getAppPath: () => tmpdir(), getPath: () => tmpdir() },
  safeStorage: { isEncryptionAvailable: () => false }
}));

const instanceBase: Omit<InstanceProfile, "gameDir"> = {
  id: "one",
  name: "One",
  minecraftVersion: "1.21.4",
  loader: "fabric",
  ramMb: 2048,
  jvmArgs: [],
  createdAt: "now",
  updatedAt: "now"
};

function versionWithQuickPlay(): VersionJson {
  return {
    id: "1.21.4",
    mainClass: "net.minecraft.client.main.Main",
    assetIndex: { id: "17", url: "https://example.test/assets", sha1: "abc" },
    downloads: { client: { url: "https://example.test/client.jar" } },
    libraries: [],
    arguments: {
      jvm: [],
      game: [
        "--username",
        "${auth_player_name}",
        {
          rules: [{ action: "allow", features: { is_quick_play_multiplayer: true } }],
          value: ["--quickPlayMultiplayer", "${quickPlayMultiplayer}"]
        }
      ]
    }
  };
}

function legacyVersion(): VersionJson {
  return {
    id: "1.16.5",
    mainClass: "net.minecraft.client.main.Main",
    assetIndex: { id: "1.16", url: "https://example.test/assets", sha1: "abc" },
    downloads: { client: { url: "https://example.test/client.jar" } },
    libraries: [],
    arguments: { jvm: [], game: ["--username", "${auth_player_name}"] }
  };
}

describe("quick join", () => {
  it("parses host:port server addresses with a default port", () => {
    expect(parseServerAddress("play.example.net")).toEqual({ host: "play.example.net", port: "25565" });
    expect(parseServerAddress("play.example.net:19132")).toEqual({ host: "play.example.net", port: "19132" });
    expect(parseServerAddress("play.example.net:bogus")).toEqual({ host: "play.example.net", port: "25565" });
  });

  it("detects quick-play-capable version JSONs", () => {
    expect(supportsQuickPlay(versionWithQuickPlay())).toBe(true);
    expect(supportsQuickPlay(legacyVersion())).toBe(false);
  });

  it("uses --quickPlayMultiplayer on modern versions", () => {
    const args = buildLaunchArguments({
      version: versionWithQuickPlay(),
      instance: { ...instanceBase, gameDir: "C:/game" },
      account: { username: "Player", uuid: "0", accessToken: "0" },
      classpath: [],
      clientJar: "C:/client.jar",
      nativesDir: "C:/natives",
      assetsRoot: "C:/assets",
      assetIndex: "17",
      quickPlayServer: "hypixel.net"
    });
    expect(args).toContain("--quickPlayMultiplayer");
    expect(args).toContain("hypixel.net");
    expect(args).not.toContain("--server");
  });

  it("falls back to --server/--port on legacy versions", () => {
    const args = buildLaunchArguments({
      version: legacyVersion(),
      instance: { ...instanceBase, gameDir: "C:/game" },
      account: { username: "Player", uuid: "0", accessToken: "0" },
      classpath: [],
      clientJar: "C:/client.jar",
      nativesDir: "C:/natives",
      assetsRoot: "C:/assets",
      assetIndex: "1.16",
      quickPlayServer: "play.example.net:25566"
    });
    expect(args).toContain("--server");
    expect(args).toContain("play.example.net");
    expect(args).toContain("--port");
    expect(args).toContain("25566");
    expect(args).not.toContain("--quickPlayMultiplayer");
  });

  it("keeps quick-play args out when no server is requested", () => {
    const args = buildLaunchArguments({
      version: versionWithQuickPlay(),
      instance: { ...instanceBase, gameDir: "C:/game" },
      account: { username: "Player", uuid: "0", accessToken: "0" },
      classpath: [],
      clientJar: "C:/client.jar",
      nativesDir: "C:/natives",
      assetsRoot: "C:/assets",
      assetIndex: "17"
    });
    expect(args).not.toContain("--quickPlayMultiplayer");
    expect(args).not.toContain("--server");
  });
});

describe("news mapping", () => {
  it("maps Mojang patch notes to absolute-image news items", () => {
    const items = mapPatchNotes({
      entries: [
        {
          id: "abc",
          title: "Minecraft 1.99",
          version: "1.99",
          type: "release",
          date: "2026-06-30T13:59:14.529Z",
          shortText: "Ships fast rendering.",
          image: { url: "/v2/images/199.jpg" }
        },
        { id: "def", title: "Snapshot", version: "x", type: "snapshot", date: "2026-06-01T00:00:00Z" }
      ]
    });
    expect(items).toHaveLength(2);
    expect(items[0].imageUrl).toBe("https://launchercontent.mojang.com/v2/images/199.jpg");
    expect(items[0].category).toBe("release");
    expect(items[1].imageUrl).toBeUndefined();
    expect(items[1].shortText).toBe("");
  });

  it("caps the number of items", () => {
    const entries = Array.from({ length: 40 }, (_, index) => ({
      id: String(index),
      title: `n${index}`,
      version: "v",
      type: "release",
      date: "2026-01-01T00:00:00Z"
    }));
    expect(mapPatchNotes({ entries })).toHaveLength(12);
  });
});

describe("installed mods manager", () => {
  let gameDir: string;
  let instance: InstanceProfile;

  beforeAll(async () => {
    gameDir = await mkdtemp(join(tmpdir(), "monkeyplay-mods-"));
    instance = { ...instanceBase, gameDir };
  });

  it("lists, toggles and deletes mod jars", async () => {
    const { deleteMod, listMods, setModEnabled } = await import("../main/mods/modService");
    const modsDir = join(gameDir, "mods");
    await import("node:fs/promises").then((fs) => fs.mkdir(modsDir, { recursive: true }));
    await writeFile(join(modsDir, "sodium.jar"), "jar");
    await writeFile(join(modsDir, "lithium.jar.disabled"), "jar");
    await writeFile(join(modsDir, "notes.txt"), "ignore me");

    let mods = await listMods(instance);
    expect(mods.map((mod) => `${mod.fileName}:${mod.enabled}`)).toEqual(["lithium.jar:false", "sodium.jar:true"]);

    await setModEnabled(instance, "sodium.jar", false);
    await setModEnabled(instance, "lithium.jar", true);
    mods = await listMods(instance);
    expect(mods.map((mod) => `${mod.fileName}:${mod.enabled}`)).toEqual(["lithium.jar:true", "sodium.jar:false"]);

    await deleteMod(instance, "sodium.jar");
    mods = await listMods(instance);
    expect(mods.map((mod) => mod.fileName)).toEqual(["lithium.jar"]);
    expect(await readdir(modsDir)).toContain("notes.txt");
  });

  it("rejects path-traversal file names", async () => {
    const { setModEnabled } = await import("../main/mods/modService");
    await expect(setModEnabled(instance, "../escape.jar", false)).rejects.toThrow(/invalid mod file name/i);
  });

  it("ships a sane, deduplicated performance pack", async () => {
    const { FPS_BOOST_MODS } = await import("../main/mods/modService");
    const slugs = FPS_BOOST_MODS.map((mod) => mod.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("sodium");
    expect(slugs).toContain("lithium");
    expect(slugs).toContain("iris");
  });
});
