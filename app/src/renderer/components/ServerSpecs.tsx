import type { ServerStatus } from "@shared/types";
import {
  Globe,
  Signal,
  Users,
  Box,
  Clock,
  AlertCircle,
  Loader2,
  MapPin,
  Server,
  Cpu,
  ShieldAlert,
  Network,
  ExternalLink
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function countryCodeToFlag(code?: string): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset));
}

interface ServerSpecsProps {
  address: string;
  compact?: boolean;
}

export function ServerSpecs({ address, compact = false }: ServerSpecsProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const trimmed = address.trim();

  useEffect(() => {
    if (!trimmed) {
      setStatus(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (trimmed.length < 3) return;

    setLoading(true);
    setError(null);

    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const result: ServerStatus = await window.monkeyplay.server.ping(trimmed);
          if (result.online) {
            setStatus(result);
            setError(null);
          } else {
            setStatus(result);
            setError(result.error ?? "Offline");
          }
        } catch (e) {
          setStatus(null);
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      })();
    }, 600);

    debounceRef.current = id;
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [trimmed]);

  if (!trimmed) return null;

  if (loading) {
    return (
      <div className={`server-specs ${compact ? "server-specs-compact" : ""}`}>
        <div className="server-specs-loading">
          <Loader2 size={14} className="spin" />
          <span>Pinging {trimmed}…</span>
        </div>
      </div>
    );
  }

  if (error && !status?.online) {
    return (
      <div className={`server-specs ${compact ? "server-specs-compact" : ""} server-specs-offline`}>
        <div className="server-specs-row">
          <AlertCircle size={14} />
          <strong>{trimmed}</strong>
          <span className="badge badge-offline">offline</span>
        </div>
        <p className="server-specs-error">{error}</p>
        <div className="server-specs-origin">
          <Globe size={12} />
          <span>
            Origin: {status?.host ?? trimmed}
            {status?.port ? `:${status.port}` : ""}
            {status?.resolvedHost && status.resolvedHost !== status.host ? ` → ${status.resolvedHost}:${status.resolvedPort}` : ""}
          </span>
        </div>
        {status?.ip || status?.geo ? (
          <div className="server-specs-section">
            <div className="server-specs-section-title">
              <MapPin size={11} /> Connection origin — server location
            </div>
            {status.ip ? (
              <div className="server-specs-origin">
                <Server size={11} />
                <span>
                  {status.ip}
                  {status.reverseDns ? ` • ${status.reverseDns}` : ""}
                </span>
              </div>
            ) : null}
            {status.geo ? (
              <>
                <div className="server-specs-origin">
                  <MapPin size={11} />
                  <span>
                    <strong>
                      {countryCodeToFlag(status.geo.countryCode)} {[status.geo.city, status.geo.regionName, status.geo.country].filter(Boolean).join(", ") || "Unknown location"}
                    </strong>
                    {status.geo.zip ? ` ${status.geo.zip}` : ""}
                    {status.geo.isp ? ` • ${status.geo.isp}` : ""}
                    {status.geo.as ? ` • ${status.geo.as}` : ""}
                  </span>
                </div>
                {status.geo.lat && status.geo.lon ? (
                  <div className="server-specs-origin">
                    <Globe size={11} />
                    <span>
                      {status.geo.lat.toFixed(4)}, {status.geo.lon.toFixed(4)}
                      {status.geo.timezone ? ` • ${status.geo.timezone}` : ""}
                    </span>
                    <button
                      type="button"
                      className="server-specs-maplink"
                      onClick={() => {
                        void window.monkeyplay.system.openExternal(`https://www.openstreetmap.org/?mlat=${status.geo!.lat}&mlon=${status.geo!.lon}#map=8/${status.geo!.lat}/${status.geo!.lon}`);
                      }}
                    >
                      View on map <ExternalLink size={10} />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="server-specs-origin">
                <MapPin size={11} />
                <span>Location unknown — private IP or geo lookup blocked</span>
              </div>
            )}
          </div>
        ) : null}
        {status?.hardware ? (
          <div className="server-specs-hardware">
            <ShieldAlert size={11} />
            <span>{status.hardware.note}</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (!status?.online) return null;

  const location = [status.geo?.city, status.geo?.regionName, status.geo?.country].filter(Boolean).join(", ");

  return (
    <div className={`server-specs ${compact ? "server-specs-compact" : ""} server-specs-online`}>
      <div className="server-specs-head">
        {status.favicon ? (
          <img src={status.favicon} alt="" className="server-specs-icon" />
        ) : (
          <div className="server-specs-icon server-specs-icon-fallback">
            <Box size={16} />
          </div>
        )}
        <div className="server-specs-title">
          <strong>{status.motd || "Minecraft Server"}</strong>
          <span className="server-specs-address">
            <Globe size={11} />
            {status.host}:{status.port}
            {status.resolvedHost && status.resolvedHost !== status.host ? ` → ${status.resolvedHost}:${status.resolvedPort}` : ""}
          </span>
        </div>
        <span className="badge badge-release">online</span>
      </div>

      <div className="server-specs-grid">
        {status.version?.name ? (
          <span className="server-specs-chip">
            <Box size={12} />
            {status.version.name}
          </span>
        ) : null}
        {status.players ? (
          <span className="server-specs-chip">
            <Users size={12} />
            {status.players.online} / {status.players.max} players
          </span>
        ) : null}
        {status.latencyMs !== undefined ? (
          <span className={`server-specs-chip ${status.latencyMs > 200 ? "server-specs-chip-warn" : ""}`}>
            <Signal size={12} />
            {status.latencyMs} ms
          </span>
        ) : null}
        {status.players?.sample && status.players.sample.length > 0 && !compact ? (
          <span className="server-specs-chip">
            <Clock size={12} />
            {status.players.sample.slice(0, 3).map((p) => p.name).join(", ")}
            {status.players.sample.length > 3 ? ` +${status.players.sample.length - 3}` : ""}
          </span>
        ) : null}
      </div>

      {!compact && status.players?.sample && status.players.sample.length > 0 ? (
        <div className="server-specs-sample">Sample: {status.players.sample.map((p) => p.name).join(", ")}</div>
      ) : null}

      <div className="server-specs-section">
        <div className="server-specs-section-title">
          <Network size={11} /> Origin & network
        </div>
        <div className="server-specs-origin">
          <Globe size={11} />
          <span>
            {status.resolvedHost}:{status.resolvedPort} · Protocol {status.version?.protocol ?? "—"}
            {status.ip ? ` · ${status.ip}` : ""}
          </span>
        </div>
        {status.reverseDns ? (
          <div className="server-specs-origin">
            <Server size={11} />
            <span>rDNS: {status.reverseDns}</span>
          </div>
        ) : null}
      </div>

      <div className="server-specs-section">
        <div className="server-specs-section-title">
          <MapPin size={11} /> Connection origin — where it&apos;s hosted
        </div>
        {status.geo ? (
          <>
            <div className="server-specs-origin">
              <MapPin size={11} />
              <span>
                <strong>
                  {countryCodeToFlag(status.geo.countryCode)} {location || "Unknown location"}
                </strong>
                {status.geo.zip ? ` ${status.geo.zip}` : ""}
                {status.geo.isp ? ` • ${status.geo.isp}` : ""}
                {status.geo.as ? ` • ${status.geo.as}` : ""}
              </span>
            </div>
            {status.geo.lat && status.geo.lon ? (
              <div className="server-specs-origin">
                <Globe size={11} />
                <span>
                  {status.geo.lat.toFixed(4)}, {status.geo.lon.toFixed(4)}
                  {status.geo.timezone ? ` • ${status.geo.timezone}` : ""}
                </span>
                <button
                  type="button"
                  className="server-specs-maplink"
                  onClick={() => {
                    void window.monkeyplay.system.openExternal(`https://www.openstreetmap.org/?mlat=${status.geo!.lat}&mlon=${status.geo!.lon}#map=8/${status.geo!.lat}/${status.geo!.lon}`);
                  }}
                >
                  View on map <ExternalLink size={10} />
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="server-specs-origin">
            <MapPin size={11} />
            <span>Location unknown — private IP, localhost, or geo lookup blocked</span>
          </div>
        )}
      </div>

      <div className="server-specs-section">
        <div className="server-specs-section-title">
          <Cpu size={11} /> Hardware specs
        </div>
        <div className="server-specs-hardware">
          <ShieldAlert size={11} />
          <span>
            {status.hardware?.note ??
              "Hardware (CPU/RAM/disk) is not exposed by the Minecraft protocol. It is host-private. For your own server, add a MonkeyPlay agent / enable RCON with a status plugin to expose it."}
          </span>
        </div>
        {!compact ? (
          <p className="server-specs-hint">
            Want specs for your server? Install a lightweight agent that serves <code>/hardware</code> (CPU, RAM, TPS) and set
            <code>MONKEYPLAY_SERVER_AGENT_URL</code> — or use Pterodactyl/RCON. Third-party servers never expose hardware without permission.
          </p>
        ) : null}
      </div>
    </div>
  );
}
