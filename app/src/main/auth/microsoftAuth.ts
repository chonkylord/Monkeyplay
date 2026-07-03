import type { DeviceCodeResponse } from "@shared/types";
import { readRefreshToken, storeRefreshToken, upsertMicrosoftAccount } from "./accountService";

const tenant = "consumers";
const deviceCodeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`;
const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
const minecraftClientId = process.env.MONKEYPLAY_MS_CLIENT_ID ?? "00000000402b5328";

interface MicrosoftDeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
  error?: string;
  error_description?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface XboxResponse {
  Token: string;
  DisplayClaims: {
    xui: Array<{ uhs: string }>;
  };
}

interface MinecraftAuthResponse {
  access_token: string;
}

interface MinecraftProfileResponse {
  id: string;
  name: string;
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "MonkeyPlay/0.1.0"
    },
    body: new URLSearchParams(body)
  });
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown, authorization?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MonkeyPlay/0.1.0",
      ...(authorization ? { Authorization: authorization } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`Auth request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const result = await postForm<MicrosoftDeviceCodeResponse>(deviceCodeUrl, {
    client_id: minecraftClientId,
    scope: "XboxLive.signin offline_access"
  });

  // Microsoft returns an error object (HTTP 400) when the client_id is not a
  // valid Azure app registered for the device-code flow. Surface that clearly
  // instead of letting an undefined verification_uri blow up downstream.
  if (result.error || !result.verification_uri || !result.user_code) {
    const detail = result.error_description ?? result.error ?? "Microsoft did not return a device code.";
    throw new Error(
      `Microsoft sign-in is not available: ${detail} ` +
        `Set a valid Azure client id via the MONKEYPLAY_MS_CLIENT_ID environment variable, ` +
        `or use an Offline account.`
    );
  }

  return {
    userCode: result.user_code,
    deviceCode: result.device_code,
    verificationUri: result.verification_uri,
    expiresIn: result.expires_in,
    interval: result.interval,
    message: result.message
  };
}

export interface MinecraftSession {
  accessToken: string;
  uuid: string;
  username: string;
}

/** Exchange a Microsoft access token for a Minecraft session (XBL → XSTS → MC → profile). */
async function minecraftSessionFromMsToken(msAccessToken: string): Promise<MinecraftSession> {
  const xbl = await postJson<XboxResponse>("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `d=${msAccessToken}`
    },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT"
  });

  const xsts = await postJson<XboxResponse>("https://xsts.auth.xboxlive.com/xsts/authorize", {
    Properties: {
      SandboxId: "RETAIL",
      UserTokens: [xbl.Token]
    },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT"
  });

  const userHash = xsts.DisplayClaims.xui[0]?.uhs;
  if (!userHash) {
    throw new Error("Xbox Live response did not include a user hash.");
  }

  const mc = await postJson<MinecraftAuthResponse>("https://api.minecraftservices.com/authentication/login_with_xbox", {
    identityToken: `XBL3.0 x=${userHash};${xsts.Token}`
  });

  const profileResponse = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: {
      Authorization: `Bearer ${mc.access_token}`,
      "User-Agent": "MonkeyPlay/0.1.0"
    }
  });
  if (!profileResponse.ok) {
    throw new Error(`Minecraft profile request failed (${profileResponse.status}).`);
  }
  const profile = (await profileResponse.json()) as MinecraftProfileResponse;
  return { accessToken: mc.access_token, uuid: profile.id, username: profile.name };
}

export async function completeDeviceCode(deviceCode: string): Promise<{ accountId: string; username: string }> {
  const token = await postForm<TokenResponse>(tokenUrl, {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: minecraftClientId,
    device_code: deviceCode
  });
  if (token.error) {
    throw new Error(token.error_description ?? token.error);
  }

  const session = await minecraftSessionFromMsToken(token.access_token);
  const account = await upsertMicrosoftAccount({
    id: session.uuid,
    username: session.username,
    uuid: session.uuid
  });
  if (token.refresh_token) {
    await storeRefreshToken(account.id, token.refresh_token);
  }
  return { accountId: account.id, username: account.username };
}

/**
 * Renew a Minecraft session for launch using the persisted Microsoft refresh
 * token, so signed-in users never re-enter credentials between sessions.
 */
export async function refreshMinecraftSession(accountId: string): Promise<MinecraftSession> {
  const refreshToken = await readRefreshToken(accountId);
  if (!refreshToken) {
    throw new Error("Microsoft sign-in is not available: no saved session for this account. Sign in again.");
  }

  const token = await postForm<TokenResponse>(tokenUrl, {
    grant_type: "refresh_token",
    client_id: minecraftClientId,
    refresh_token: refreshToken,
    scope: "XboxLive.signin offline_access"
  });
  if (token.error || !token.access_token) {
    throw new Error(
      `Microsoft sign-in is not available: ${token.error_description ?? token.error ?? "token refresh failed"}. Sign in again.`
    );
  }

  const session = await minecraftSessionFromMsToken(token.access_token);
  await upsertMicrosoftAccount({ id: session.uuid, username: session.username, uuid: session.uuid });
  if (token.refresh_token) {
    await storeRefreshToken(accountId, token.refresh_token);
  }
  return session;
}

