import type { LaunchEvent } from "@shared/types";

interface LogsPanelProps {
  launches: LaunchEvent[];
}

function phaseClass(event: LaunchEvent): string {
  if (event.phase === "failed") {
    return "log-line log-failed";
  }
  if (event.phase === "exited") {
    return event.exitCode && event.exitCode !== 0 ? "log-line log-failed" : "log-line log-ok";
  }
  if (event.phase === "running") {
    return "log-line log-ok";
  }
  return "log-line";
}

export function LogsPanel({ launches }: LogsPanelProps) {
  return (
    <section className="panel h-full">
      <div className="panel-heading">
        <h2>Logs</h2>
        <span>{launches.length} events</span>
      </div>
      <div className="log-list">
        {launches.length === 0 ? (
          <p className="empty">No launch events yet.</p>
        ) : (
          launches.map((event) => (
            <div className={phaseClass(event)} key={`${event.id}-${event.timestamp}-${event.phase}`}>
              <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
              <strong>{event.phase}</strong>
              <span>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
