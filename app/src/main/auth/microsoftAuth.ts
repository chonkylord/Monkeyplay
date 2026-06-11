import type { DeviceCodeResponse } from "@shared/types";
import { storeRefreshToken, upsertMicrosoftAccount } from "./accountService";

const tenant = "consumers";
const deviceCodeUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`;
const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
const minecraftClientId = process.env.CHUNKYPLAY_MS_CLIENT_ID ?? "00000000402b5328";

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
      "User-Agent": "ChunkyPlay/0.1.0"
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
      "User-Agent": "ChunkyPlay/0.1.0",
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
        `Set a valid Azure client id via the CHUNKYPLAY_MS_CLIENT_ID environment variable, ` +
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

export async function completeDeviceCode(deviceCode: string): Promise<{ accountId: string; username: string }> {
  const token = await postForm<TokenResponse>(tokenUrl, {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: minecraftClientId,
    device_code: deviceCode
  });
  if (token.error) {
    throw new Error(token.error_description ?? token.error);
  }

  const xbl = await postJson<XboxResponse>("https://user.auth.xboxlive.com/user/authenticate", {
    Properties: {
      AuthMethod: "RPS",
      SiteName: "user.auth.xboxlive.com",
      RpsTicket: `d=${token.access_token}`
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
      "User-Agent": "ChunkyPlay/0.1.0"
    }
  });
  if (!profileResponse.ok) {
    throw new Error(`Minecraft profile request failed (${profileResponse.status}).`);
  }
  const profile = (await profileResponse.json()) as MinecraftProfileResponse;
  const account = await upsertMicrosoftAccount({
    id: profile.id,
    username: profile.name,
    uuid: profile.id
  });
  if (token.refresh_token) {
    await storeRefreshToken(account.id, token.refresh_token);
  }
  return { accountId: account.id, username: account.username };
}

