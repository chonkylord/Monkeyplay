import type { AccountProfile } from "@shared/types";
import { safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { dataRoot } from "../paths";
import { readJson, writeJson } from "../storage";
import { offlineUuid, sanitizeOfflineUsername } from "../launch-core/offline";

function accountsPath(): string {
  return join(dataRoot(), "accounts.json");
}

function secretsDir(): string {
  return join(dataRoot(), "secrets");
}

function tokenPath(accountId: string): string {
  return join(secretsDir(), `${accountId.replace(/[^A-Za-z0-9_.-]/g, "_")}.bin`);
}

async function readAccounts(): Promise<AccountProfile[]> {
  return readJson<AccountProfile[]>(accountsPath(), []);
}

async function writeAccounts(accounts: AccountProfile[]): Promise<void> {
  await writeJson(accountsPath(), accounts);
}

export async function listAccounts(): Promise<AccountProfile[]> {
  return readAccounts();
}

export async function createOfflineAccount(usernameInput: string): Promise<AccountProfile> {
  const username = sanitizeOfflineUsername(usernameInput);
  const now = new Date().toISOString();
  const account: AccountProfile = {
    id: `offline-${username.toLowerCase()}`,
    type: "offline",
    username,
    uuid: offlineUuid(username),
    active: true,
    createdAt: now,
    lastUsedAt: now
  };
  const accounts = (await readAccounts()).map((item) => ({ ...item, active: false }));
  await writeAccounts([...accounts.filter((item) => item.id !== account.id), account]);
  return account;
}

export async function upsertMicrosoftAccount(profile: Omit<AccountProfile, "type" | "active" | "createdAt" | "lastUsedAt">): Promise<AccountProfile> {
  const now = new Date().toISOString();
  const accounts = await readAccounts();
  const existing = accounts.find((account) => account.id === profile.id);
  const next: AccountProfile = {
    ...profile,
    type: "microsoft",
    active: true,
    createdAt: existing?.createdAt ?? now,
    lastUsedAt: now
  };
  await writeAccounts([...accounts.filter((account) => account.id !== profile.id).map((item) => ({ ...item, active: false })), next]);
  return next;
}

export async function setActiveAccount(accountId: string): Promise<AccountProfile[]> {
  const accounts = await readAccounts();
  if (!accounts.some((account) => account.id === accountId)) {
    throw new Error(`Account not found: ${accountId}`);
  }
  const now = new Date().toISOString();
  const next = accounts.map((account) => ({
    ...account,
    active: account.id === accountId,
    lastUsedAt: account.id === accountId ? now : account.lastUsedAt
  }));
  await writeAccounts(next);
  return next;
}

export async function deleteAccount(accountId: string): Promise<void> {
  await writeAccounts((await readAccounts()).filter((account) => account.id !== accountId));
  await rm(tokenPath(accountId), { force: true });
}

export async function storeRefreshToken(accountId: string, refreshToken: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS encryption is not available, refusing to persist a refresh token.");
  }
  await mkdir(secretsDir(), { recursive: true });
  await writeFile(tokenPath(accountId), safeStorage.encryptString(refreshToken));
}

export async function readRefreshToken(accountId: string): Promise<string | undefined> {
  try {
    const encrypted = await readFile(tokenPath(accountId));
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

