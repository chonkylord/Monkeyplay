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

export function rulesAllow(rules: Rule[] | undefined): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }
  let allowed = false;
  for (const rule of rules) {
    const osMatches = !rule.os?.name || rule.os.name === minecraftOsName();
    if (osMatches) {
      allowed = rule.action === "allow";
    }
  }
  return allowed;
}

