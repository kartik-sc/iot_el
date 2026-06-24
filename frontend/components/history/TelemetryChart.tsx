"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TelemetrySnapshot } from "@/types/crane";

interface TelemetryChartProps {
  snapshots: TelemetrySnapshot[];
  loading: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TelemetryChart({ snapshots, loading }: TelemetryChartProps) {
  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center font-mono">Loading telemetry history…</div>;
  }
  if (snapshots.length === 0) {
    return <div className="text-slate-600 text-sm py-8 text-center font-mono">No telemetry data in this time range.</div>;
  }

  const data = snapshots.map((s) => ({
    t: formatTime(s.recorded_at),
    theta: s.current_theta ?? null,
    R: s.current_R ?? null,
    H: s.current_H ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#6b8ca8" }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: "#6b8ca8" }} />
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "#6b8ca8" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="theta" name="θ (°)" stroke="#00d4ff" dot={false} strokeWidth={1.5} connectNulls />
        <Line type="monotone" dataKey="R" name="R (cm)" stroke="#ffb800" dot={false} strokeWidth={1.5} connectNulls />
        <Line type="monotone" dataKey="H" name="H (cm)" stroke="#00ff88" dot={false} strokeWidth={1.5} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
