import type { ServerStatus } from "@shared/types";
import { promises as dns } from "node:dns";
import * as net from "node:net";
import { parseServerAddress } from "../launch-core/arguments";

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let temp = v & 0x7f;
    v >>>= 7;
    if (v !== 0) temp |= 0x80;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset = 0): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;
  let shift = 0;
  while (true) {
    if (offset + bytesRead >= buffer.length) throw new Error("Incomplete VarInt");
    const byte = buffer[offset + bytesRead];
    bytesRead += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift >= 35) throw new Error("VarInt too big");
    if (bytesRead > 5) throw new Error("VarInt too big");
  }
  return { value, bytesRead };
}

function writeString(value: string): Buffer {
  const data = Buffer.from(value, "utf8");
  return Buffer.concat([writeVarInt(data.length), data]);
}

function writeUnsignedShort(value: number): Buffer {
  const buf = Buffer.allocUnsafe(2);
  buf.writeUInt16BE(value, 0);
  return buf;
}

function stripColorCodes(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, "");
}

function motdToPlain(input: unknown): string {
  if (typeof input === "string") return stripColorCodes(input);
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.text === "string") {
      let out = stripColorCodes(obj.text);
      if (Array.isArray(obj.extra)) {
        for (const part of obj.extra) out += motdToPlain(part);
      }
      return out;
    }
    if (typeof (obj as { translate?: string }).translate === "string") {
      return String((obj as { translate?: string }).translate);
    }
  }
  try {
    return stripColorCodes(JSON.stringify(input));
  } catch {
    return String(input);
  }
}

async function resolveSrv(host: string, explicitPort: boolean): Promise<{ host: string; port: number } | undefined> {
  if (explicitPort) return undefined;
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (records.length > 0) {
      records.sort((a, b) => a.priority - b.priority || a.weight - b.weight);
      return { host: records[0].name, port: records[0].port };
    }
  } catch {
    // No SRV
  }
  return undefined;
}

async function enrichNetwork(host: string, base: ServerStatus): Promise<ServerStatus> {
  let ip: string | undefined;
  let reverseDns: string | undefined;
  let geo: ServerStatus["geo"] | undefined;
  try {
    const lookup = await dns.lookup(host);
    ip = lookup.address;
  } catch {
    // ignore
  }
  if (ip) {
    try {
      const rev = await dns.reverse(ip);
      if (rev.length > 0) reverseDns = rev[0];
    } catch {
      // no reverse
    }
    try {
      const ctrl = AbortSignal.timeout(3500);
      const resp = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`,
        {
          signal: ctrl,
          headers: { "User-Agent": "MonkeyPlay/0.1.0" }
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as Record<string, string | number>;
        if (data.status === "success") {
          geo = {
            country: String(data.country ?? ""),
            countryCode: String(data.countryCode ?? ""),
            regionName: String(data.regionName ?? ""),
            city: String(data.city ?? ""),
            zip: String(data.zip ?? ""),
            lat: Number(data.lat),
            lon: Number(data.lon),
            timezone: String(data.timezone ?? ""),
            isp: String(data.isp ?? ""),
            org: String(data.org ?? ""),
            as: String(data.as ?? ""),
            query: String(data.query ?? "")
          };
        }
      }
    } catch {
      // geo best-effort
    }
  }
  return {
    ...base,
    ip,
    reverseDns,
    geo,
    hardware: {
      note: "CPU/RAM/disk are private to the host. To view hardware for your own server, run a MonkeyPlay agent or enable RCON + a status plugin — arbitrary remote hardware lookup is blocked by the OS."
    }
  };
}

export async function pingServer(rawAddress: string, timeoutMs = 5000): Promise<ServerStatus> {
  const trimmed = rawAddress.trim();
  if (!trimmed) throw new Error("Server address is empty");
  if (trimmed.length > 255) throw new Error("Server address too long");

  const parsed = parseServerAddress(trimmed);
  const explicitPort = trimmed.includes(":") && /:\d+$/.test(trimmed);
  const srv = await resolveSrv(parsed.host, explicitPort);

  const host = srv?.host ?? parsed.host;
  const port = srv?.port ?? Number(parsed.port);

  const address = trimmed;
  const base: ServerStatus = {
    address,
    host: parsed.host,
    port,
    online: false,
    resolvedHost: host,
    resolvedPort: port
  };

  if (!host || host.length === 0) return enrichNetwork(host, { ...base, error: "Invalid host" });
  if (port < 1 || port > 65535) return enrichNetwork(host, { ...base, error: "Invalid port" });

  const enrichedBase = await enrichNetwork(host, base);

  return new Promise<ServerStatus>((resolve) => {
    let settled = false;
    const finish = (status: ServerStatus) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore destroy errors
      }
      resolve(status);
    };

    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let stage: "status" | "ping" = "status";
    let pingStart = 0;
    let lastStatus: ServerStatus | undefined;

    const timeout = setTimeout(() => finish({ ...enrichedBase, error: "Timed out" }), timeoutMs);

    socket.setTimeout(timeoutMs, () => finish({ ...enrichedBase, error: "Connection timed out" }));
    socket.on("error", (err) => {
      clearTimeout(timeout);
      finish({ ...enrichedBase, error: err.message });
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      if (!settled) finish({ ...enrichedBase, error: "Connection closed" });
    });

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const loop = (): void => {
        if (buffer.length === 0) return;
        let lenInfo: { value: number; bytesRead: number };
        try {
          lenInfo = readVarInt(buffer, 0);
        } catch {
          return;
        }
        const packetLength = lenInfo.value;
        const headerSize = lenInfo.bytesRead;
        if (buffer.length < headerSize + packetLength) return;
        const packet = buffer.subarray(headerSize, headerSize + packetLength);
        buffer = buffer.subarray(headerSize + packetLength);
        let idInfo: { value: number; bytesRead: number };
        try {
          idInfo = readVarInt(packet, 0);
        } catch {
          finish({ ...enrichedBase, error: "Invalid packet" });
          return;
        }
        const packetId = idInfo.value;
        const dataOffset = idInfo.bytesRead;

        if (stage === "status") {
          if (packetId !== 0x00) {
            finish({ ...enrichedBase, error: `Unexpected status packet ${packetId}` });
            return;
          }
          let jsonLenInfo: { value: number; bytesRead: number };
          try {
            jsonLenInfo = readVarInt(packet, dataOffset);
          } catch {
            finish({ ...enrichedBase, error: "Invalid status packet" });
            return;
          }
          const jsonLen = jsonLenInfo.value;
          const jsonOffset = dataOffset + jsonLenInfo.bytesRead;
          const jsonStr = packet.subarray(jsonOffset, jsonOffset + jsonLen).toString("utf8");
          let json: Record<string, unknown>;
          try {
            json = JSON.parse(jsonStr) as Record<string, unknown>;
          } catch {
            finish({ ...enrichedBase, error: "Invalid JSON from server" });
            return;
          }
          const version = json.version as { name?: string; protocol?: number } | undefined;
          const players = json.players as { online?: number; max?: number; sample?: Array<{ name: string; id: string }> } | undefined;
          const description = json.description;
          const favicon = json.favicon as string | undefined;
          const motd = motdToPlain(description);
          lastStatus = {
            ...enrichedBase,
            online: true,
            version: version ? { name: String(version.name ?? ""), protocol: Number(version.protocol ?? 0) } : undefined,
            players: players ? { online: Number(players.online ?? 0), max: Number(players.max ?? 0), sample: players.sample } : undefined,
            motd: motd || undefined,
            motdRaw: description,
            favicon: favicon || undefined,
            description: motd || undefined
          };
          stage = "ping";
          pingStart = Date.now();
          const pingPayload = Buffer.allocUnsafe(8);
          pingPayload.writeBigInt64BE(BigInt(pingStart), 0);
          const pingData = Buffer.concat([writeVarInt(0x01), pingPayload]);
          const pingPacket = Buffer.concat([writeVarInt(pingData.length), pingData]);
          socket.write(pingPacket);
          if (buffer.length > 0) loop();
        } else if (stage === "ping") {
          const latency = Date.now() - pingStart;
          if (lastStatus) finish({ ...lastStatus, latencyMs: latency });
          else finish({ ...enrichedBase, online: true, latencyMs: latency });
        }
      };
      loop();
    });

    try {
      const protocol = 760;
      const handshakeData = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(protocol),
        writeString(host),
        writeUnsignedShort(port),
        writeVarInt(1)
      ]);
      const handshakePacket = Buffer.concat([writeVarInt(handshakeData.length), handshakeData]);
      const statusData = writeVarInt(0x00);
      const statusPacket = Buffer.concat([writeVarInt(statusData.length), statusData]);
      socket.connect(port, host, () => {
        socket.write(handshakePacket);
        socket.write(statusPacket);
      });
    } catch (e) {
      clearTimeout(timeout);
      finish({ ...enrichedBase, error: (e as Error).message });
    }
  });
}
