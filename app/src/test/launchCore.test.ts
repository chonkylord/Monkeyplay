import { describe, expect, it } from "vitest";
import { requiredJavaMajor } from "../main/java/javaService";
import { buildLaunchArguments } from "../main/launch-core/arguments";
import { diagnose } from "../main/launch-core/diagnostics";
import { applyLoader, mavenNameToPath } from "../main/launch-core/loaders";
import { offlineUuid, sanitizeOfflineUsername } from "../main/launch-core/offline";
import type { InstanceProfile } from "@shared/types";
import type { VersionJson } from "../main/launch-core/mojang";

describe("offline launch helpers", () => {
  it("creates stable offline UUIDs", () => {
    expect(offlineUuid("Steve")).toBe(offlineUuid("Steve"));
    expect(offlineUuid("Steve")).not.toBe(offlineUuid("Alex"));
  });

  it("sanitizes offline usernames to vanilla-safe characters", () => {
    expect(sanitizeOfflineUsername("PvP Player!")).toBe("PvPPlayer");
    expect(sanitizeOfflineUsername("")).toBe("Player");
  });
});

describe("java runtime selection policy", () => {
  it("maps Minecraft versions to expected Java majors", () => {
    expect(requiredJavaMajor("1.16.5")).toBe(8);
    expect(requiredJavaMajor("1.17.1")).toBe(17);
    expect(requiredJavaMajor("1.20.4")).toBe(17);
    expect(requiredJavaMajor("1.20.5")).toBe(21);
    expect(requiredJavaMajor("1.21.4")).toBe(21);
  });
});

describe("argument builder", () => {
  it("substitutes auth, asset, game, native, and classpath placeholders", () => {
    const instance: InstanceProfile = {
      id: "one",
      name: "One",
      minecraftVersion: "1.21.4",
      loader: "vanilla",
      ramMb: 2048,
      jvmArgs: ["-Dchunky=true"],
      gameDir: "C:/game",
      createdAt: "now",
      updatedAt: "now"
    };
    const version: VersionJson = {
      id: "1.21.4",
      mainClass: "net.minecraft.client.main.Main",
      assetIndex: { id: "17", url: "https://example.test/assets", sha1: "abc" },
      downloads: { client: { url: "https://example.test/client.jar" } },
      libraries: [],
      arguments: {
        jvm: ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"],
        game: ["--username", "${auth_player_name}", "--gameDir", "${game_directory}", "--assetsDir", "${assets_root}"]
      }
    };
    const args = buildLaunchArguments({
      version,
      instance,
      account: { username: "Player", uuid: "00000000-0000-0000-0000-000000000000", accessToken: "0" },
      classpath: ["C:/lib/a.jar"],
      clientJar: "C:/client.jar",
      nativesDir: "C:/natives",
      assetsRoot: "C:/assets",
      assetIndex: "17"
    });

    expect(args).toContain("-Dchunky=true");
    expect(args).toContain("-Xmx2048M");
    expect(args).toContain("-Xms1024M");
    expect(args).toContain("-Djava.library.path=C:/natives");
    expect(args).toContain("net.minecraft.client.main.Main");
    expect(args).toContain("Player");
    expect(args).toContain("C:/game");
  });

  it("keeps the minimum heap at or below the configured maximum", () => {
    const base: InstanceProfile = {
      id: "low",
      name: "Low",
      minecraftVersion: "1.21.4",
      loader: "vanilla",
      ramMb: 768,
      jvmArgs: [],
      gameDir: "C:/game",
      createdAt: "now",
      updatedAt: "now"
    };
    const version: VersionJson = {
      id: "1.21.4",
      mainClass: "net.minecraft.client.main.Main",
      assetIndex: { id: "17", url: "https://example.test/assets", sha1: "abc" },
      downloads: { client: { url: "https://example.test/client.jar" } },
      libraries: []
    };
    const args = buildLaunchArguments({
      version,
      instance: base,
      account: { username: "Player", uuid: "0", accessToken: "0" },
      classpath: [],
      clientJar: "C:/client.jar",
      nativesDir: "C:/natives",
      assetsRoot: "C:/assets",
      assetIndex: "17"
    });
    expect(args).toContain("-Xms768M");
    expect(args).toContain("-Xmx768M");
  });
});

describe("loader resolution", () => {
  const version: VersionJson = {
    id: "1.21.4",
    mainClass: "net.minecraft.client.main.Main",
    assetIndex: { id: "17", url: "https://example.test/assets", sha1: "abc" },
    downloads: { client: { url: "https://example.test/client.jar" } },
    libraries: []
  };

  it("maps Maven coordinates to repository paths", () => {
    expect(mavenNameToPath("net.fabricmc:intermediary:1.21.4")).toBe(
      "net/fabricmc/intermediary/1.21.4/intermediary-1.21.4.jar"
    );
    expect(mavenNameToPath("org.ow2.asm:asm:9.7:sources")).toBe("org/ow2/asm/asm/9.7/asm-9.7-sources.jar");
  });

  it("returns the vanilla version untouched", async () => {
    const result = await applyLoader(version, "vanilla", "1.21.4");
    expect(result.version.mainClass).toBe("net.minecraft.client.main.Main");
    expect(result.loaderVersion).toBeUndefined();
  });

  it("refuses Forge/NeoForge with an actionable message", async () => {
    await expect(applyLoader(version, "forge", "1.21.4")).rejects.toThrow(/not yet auto-installed/i);
    await expect(applyLoader(version, "neoforge", "1.21.4")).rejects.toThrow(/NeoForge/);
  });
});

describe("launch diagnostics", () => {
  it("classifies missing Java", () => {
    expect(diagnose(new Error("Java 21 is required for Minecraft 1.21.4")).code).toBe("CP-JAVA-001");
  });

  it("classifies network failures", () => {
    expect(diagnose(new Error("fetch failed")).code).toBe("CP-NET-004");
  });

  it("classifies unknown errors with a stable fallback code", () => {
    const result = diagnose(new Error("something weird happened"));
    expect(result.code).toBe("CP-UNKNOWN-000");
    expect(result.hint).toMatch(/launch log/i);
  });
});

