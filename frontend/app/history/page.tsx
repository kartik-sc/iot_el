"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CommandTable } from "@/components/history/CommandTable";
import { TelemetryChart } from "@/components/history/TelemetryChart";
import { api } from "@/lib/api";
import type { CommandOut, TelemetrySnapshot, FaultEvent } from "@/types/crane";

// TODO: Replace with real crane_id from user's selected crane
const CRANE_ID = "00000000-0000-0000-0000-000000000000";

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

export default function HistoryPage() {
  const [commands, setCommands] = useState<CommandOut[]>([]);
  const [snapshots, setSnapshots] = useState<TelemetrySnapshot[]>([]);
  const [faults, setFaults] = useState<FaultEvent[]>([]);
  const [loadingCmd, setLoadingCmd] = useState(true);
  const [loadingTelem, setLoadingTelem] = useState(true);
  const [rangeHours, setRangeHours] = useState(1);

  useEffect(() => {
    setLoadingCmd(true);
    api.commands
      .list(CRANE_ID, 100, 0)
      .then((r) => setCommands(r.items))
      .catch(() => setCommands([]))
      .finally(() => setLoadingCmd(false));

    api.faults.list(CRANE_ID).then(setFaults).catch(() => setFaults([]));
  }, []);

  useEffect(() => {
    setLoadingTelem(true);
    api.telemetry
      .history(CRANE_ID, hoursAgo(rangeHours), new Date().toISOString())
      .then(setSnapshots)
      .catch(() => setSnapshots([]))
      .finally(() => setLoadingTelem(false));
  }, [rangeHours]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0e17]">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 bg-[#111827] border-b border-cyan-500 shadow-[0_1px_14px_rgba(0,212,255,0.12)]">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <rect x="11.5" y="9" width="3" height="15" rx="0.75" fill="#00d4ff"/>
            <rect x="7.5" y="22.5" width="11" height="2" rx="0.75" fill="#00d4ff"/>
            <rect x="4" y="7.5" width="18" height="2" rx="0.75" fill="#00d4ff"/>
            <circle cx="13" cy="3.5" r="1.75" fill="#00d4ff"/>
            <line x1="13" y1="3.5" x2="20.5" y2="8" stroke="#00d4ff" strokeWidth="1.1"/>
            <line x1="19" y1="9.5" x2="19" y2="18.5" stroke="#00d4ff" strokeWidth="0.9"/>
          </svg>
          <span className="font-bold text-[17px] tracking-[0.16em] text-cyan-400">CRANE CTRL</span>
          <span className="text-slate-500 text-sm ml-2">/ History</span>
        </div>
        <Link href="/dashboard" className="text-[11px] tracking-widest uppercase text-slate-400 hover:text-cyan-400 transition-colors">
          ← Dashboard
        </Link>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-6xl mx-auto w-full">

        {/* Telemetry chart */}
        <section className="bg-[#111827] border border-[#1e2d45] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-slate-500">
              Telemetry History
            </h2>
            <div className="flex gap-2">
              {[0.5, 1, 6, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setRangeHours(h)}
                  className={`px-3 py-1 rounded text-[11px] font-mono tracking-wide border transition-colors
                    ${rangeHours === h
                      ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                      : "border-[#1e2d45] text-slate-500 hover:border-slate-500"}`}
                >
                  {h < 1 ? `${h * 60}m` : `${h}h`}
                </button>
              ))}
            </div>
          </div>
          <TelemetryChart snapshots={snapshots} loading={loadingTelem} />
        </section>

        {/* Fault events */}
        {faults.length > 0 && (
          <section className="bg-[#111827] border border-red-500/30 rounded-xl p-5">
            <h2 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-red-400/70 mb-4">
              Fault Events
            </h2>
            <div className="space-y-2">
              {faults.map((f) => (
                <div key={f.id} className="flex items-center gap-4 text-xs font-mono border-b border-[#1e2d45]/50 pb-2">
                  <span className="text-red-400">{f.motor_status}</span>
                  <span className="text-slate-500">{f.system_status}</span>
                  <span className="text-slate-400">{new Date(f.occurred_at).toLocaleString()}</span>
                  <span className={f.resolved_at ? "text-emerald-400" : "text-red-400"}>
                    {f.resolved_at ? `Resolved ${new Date(f.resolved_at).toLocaleTimeString()}` : "Open"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Command history */}
        <section className="bg-[#111827] border border-[#1e2d45] rounded-xl p-5">
          <h2 className="text-[11px] tracking-[0.22em] uppercase font-semibold text-slate-500 mb-4">
            Command History
          </h2>
          <CommandTable commands={commands} loading={loadingCmd} />
        </section>
      </main>
    </div>
  );
}
