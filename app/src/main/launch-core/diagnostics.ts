/**
 * Turns raw launch failures into actionable diagnostics. Each rule maps a class
 * of error to a stable code and a remediation hint, so the UI can show the user
 * *why* a launch failed and what to do, instead of an opaque stack trace.
 */
export interface Diagnosis {
  code: string;
  message: string;
  hint: string;
}

interface Rule {
  code: string;
  match: (message: string) => boolean;
  hint: string;
}

const rules: Rule[] = [
  {
    code: "CP-JAVA-001",
    match: (m) => /no compatible runtime was detected|java \d+ is required/i.test(m),
    hint: "Install a matching Java runtime (Temurin 8/17/21) and ensure it is on PATH or JAVA_HOME, then click Refresh."
  },
  {
    code: "CP-LOADER-002",
    match: (m) => /not yet auto-installed|loader metadata request failed|has no builds for minecraft/i.test(m),
    hint: "Pick a Minecraft version the loader supports, or use a Fabric/Quilt instance for Modrinth mods."
  },
  {
    code: "CP-VERSION-003",
    match: (m) => /minecraft version not found/i.test(m),
    hint: "Use an exact Mojang version id (e.g. 1.21.4). Snapshots use ids like 24w45a."
  },
  {
    code: "CP-NET-004",
    match: (m) => /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|getaddrinfo|request failed \(5\d\d\)|EAI_AGAIN/i.test(m),
    hint: "Check your internet connection or proxy; Mojang/Modrinth/Fabric servers may be temporarily unreachable. Retry."
  },
  {
    code: "CP-HASH-005",
    match: (m) => /SHA-1 mismatch/i.test(m),
    hint: "A downloaded file was corrupted. Delete the launcher cache (shared/) or retry; this is usually a transient CDN error."
  },
  {
    code: "CP-AUTH-007",
    match: (m) => /microsoft sign-in is not available|authorization_pending|xbox live|minecraft profile request failed/i.test(m),
    hint: "Microsoft sign-in needs a valid Azure client id (MONKEYPLAY_MS_CLIENT_ID). Offline accounts work without it."
  },
  {
    code: "CP-DISK-006",
    match: (m) => /ENOSPC|EACCES|EPERM|EROFS/i.test(m),
    hint: "MonkeyPlay could not write to its data directory. Free disk space or run with permission to the app-data folder."
  }
];

export function diagnose(error: unknown): Diagnosis {
  const message = error instanceof Error ? error.message : String(error);
  const rule = rules.find((candidate) => candidate.match(message));
  if (rule) {
    return { code: rule.code, message, hint: rule.hint };
  }
  return {
    code: "CP-UNKNOWN-000",
    message,
    hint: "Unexpected error. Check the launch log for details and report the code above if it persists."
  };
}

/** Format a diagnosis for a single-line log/banner entry. */
export function formatDiagnosis(diagnosis: Diagnosis): string {
  return `[${diagnosis.code}] ${diagnosis.message} — ${diagnosis.hint}`;
}
