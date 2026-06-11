import { createHash } from "node:crypto";

export function offlineUuid(username: string): string {
  const hex = createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sanitizeOfflineUsername(username: string | undefined): string {
  const cleaned = (username ?? "Player").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
  return cleaned || "Player";
}

