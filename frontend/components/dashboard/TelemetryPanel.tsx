"use client";

import type { Telemetry } from "@/types/crane";
import { CRANE_LIMITS } from "@/types/crane";

interface TelemetryPanelProps {
  telemetry: Telemetry;
}

const STATUS_STYLES: Record<string, string> = {
  IDLE:    "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-dim)]",
  MOVING:  "text-[var(--warning)] border-[var(--warning)] bg-[rgba(255,184,0,0.1)] animate-pulse",
  ERROR:   "text-[var(--error)] border-[var(--error)] bg-[rgba(255,68,68,0.1)] animate-pulse",
  TIMEOUT: "text-[var(--error)] border-[var(--error)] bg-[rgba(255,68,68,0.1)]",
};

function Readout({ label, value, unit, norm }: {
  label: string;
  value: number | null;
  unit: string;
  norm: number;
}) {
  const display = value !== null ? `${value}${unit}` : "—";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--text-secondary)] font-semibold">{label}</div>
      <div className="font-mono text-[2rem] font-bold text-[var(--text-mono)] leading-none overflow-hidden h-8">
        <span className="block">{display}</span>
      </div>
      <div className="h-[3px] bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, norm * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function TelemetryPanel({ telemetry }: TelemetryPanelProps) {
  const { current_theta, current_R, current_H, motor_status, system_status, last_updated } = telemetry;
  const motorStyle = STATUS_STYLES[motor_status] ?? STATUS_STYLES.IDLE;
  const sysOk  = system_status === "OK";
  const isFault = !sysOk || motor_status === "ERROR" || motor_status === "TIMEOUT";

  return (
    <div className="space-y-4">
      {isFault && (
        <div className="bg-[rgba(255,68,68,0.1)] border border-[var(--error)] rounded-lg px-3.5 py-2 text-[var(--error)] text-[13px] font-semibold">
          ⚠ {system_status !== "OK" ? system_status : motor_status} — check hardware status
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Readout label="θ (Boom)"    value={current_theta} unit="°"   norm={(current_theta ?? 0) / CRANE_LIMITS.theta.max} />
        <Readout label="R (Trolley)" value={current_R}     unit=" cm" norm={(current_R ?? 0)     / CRANE_LIMITS.R.max} />
        <Readout label="H (Hook)"    value={current_H}     unit=" cm" norm={(current_H ?? 0)     / CRANE_LIMITS.H.max} />
      </div>

      <div className="flex items-center gap-5 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-secondary)] font-semibold tracking-[0.06em] uppercase">System</span>
          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${sysOk ? "text-[var(--success)] bg-[rgba(0,255,136,0.12)]" : "text-[var(--error)] bg-[rgba(255,68,68,0.12)]"}`}>
            {system_status}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-secondary)] font-semibold tracking-[0.06em] uppercase">Motor</span>
          <span className={`font-mono font-bold px-1.5 py-0.5 rounded border text-[10px] ${motorStyle}`}>
            {motor_status}
          </span>
        </div>
        {last_updated && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-secondary)] font-semibold tracking-[0.06em] uppercase">Updated</span>
            <span className="font-mono text-[var(--text-secondary)]">{new Date(last_updated).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
