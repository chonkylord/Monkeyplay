export interface Rule {
  action: "allow" | "disallow";
  os?: {
    name?: "windows" | "osx" | "linux";
    arch?: string;
    version?: string;
  };
  features?: Record<string, boolean>;
}

function minecraftOsName(): "windows" | "osx" | "linux" {
  if (process.platform === "win32") {
    return "windows";
  }
  if (process.platform === "darwin") {
    return "osx";
  }
  return "linux";
}

/**
 * Evaluate Mojang argument/library rules against the current OS and the set of
 * enabled launch "features". MonkeyPlay enables no optional features, so
 * feature-gated args (`--demo`, `--quickPlay*`, custom resolution) must be
 * excluded — otherwise the game boots into the demo world and tries to
 * quick-play-connect to an empty server. A rule only takes effect when *both*
 * its OS and feature conditions match; unmatched rules are ignored.
 */
export function rulesAllow(rules: Rule[] | undefined, features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }
  let allowed = false;
  for (const rule of rules) {
    const osMatches = !rule.os?.name || rule.os.name === minecraftOsName();
    const featuresMatch =
      !rule.features || Object.entries(rule.features).every(([key, value]) => (features[key] ?? false) === value);
    if (osMatches && featuresMatch) {
      allowed = rule.action === "allow";
    }
  }
  return allowed;
}

