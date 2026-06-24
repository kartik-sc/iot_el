"use client";

import Link from "next/link";
import { useFirebaseTelemetry } from "@/hooks/useFirebaseTelemetry";
import { useSendCommand } from "@/hooks/useSendCommand";
import { useCommandHistory } from "@/hooks/useCommandHistory";
import { CommandPanel } from "@/components/dashboard/CommandPanel";
import { TelemetryPanel } from "@/components/dashboard/TelemetryPanel";
import { CraneAnimationPanel } from "@/components/crane/CraneAnimationPanel";

// TODO: Replace null with actual crane_id once cranes API is seeded
const CRANE_ID: string | null = null;
const CRANE_NAMESPACE = "";

export default function DashboardPage() {
  const { telemetry, connected } = useFirebaseTelemetry(CRANE_NAMESPACE);
  const { history, addCommand } = useCommandHistory();
  const { sendCommand, sendEStop, status: sendStatus, lastCmd } = useSendCommand(
    CRANE_ID,
    CRANE_NAMESPACE,
    addCommand,
  );

  const lastCmd_ = lastCmd;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--accent)",
          boxShadow: "0 1px 14px rgba(0,212,255,0.12)",
        }}>
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <rect x="11.5" y="9" width="3" height="15" rx="0.75" fill="var(--accent)"/>
            <rect x="7.5" y="22.5" width="11" height="2" rx="0.75" fill="var(--accent)"/>
            <rect x="4" y="7.5" width="18" height="2" rx="0.75" fill="var(--accent)"/>
            <rect x="3.5" y="8" width="5" height="1.5" rx="0.5" fill="var(--accent)" opacity="0.55"/>
            <circle cx="13" cy="3.5" r="1.75" fill="var(--accent)"/>
            <line x1="13" y1="3.5" x2="20.5" y2="8" stroke="var(--accent)" strokeWidth="1.1" opacity="0.8"/>
            <line x1="13" y1="3.5" x2="5.5" y2="8" stroke="var(--accent)" strokeWidth="0.9" opacity="0.55"/>
            <line x1="19" y1="9.5" x2="19" y2="18.5" stroke="var(--accent)" strokeWidth="0.9" opacity="0.85"/>
            <path d="M17.5 18.5 Q19 20.5 20.5 18.5" stroke="var(--accent)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
          </svg>
          <span className="font-bold text-[17px] tracking-[0.16em]" style={{ color: "var(--accent)" }}>CRANE CTRL</span>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/history"
            className="text-[11px] tracking-widest uppercase transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            History
          </Link>
          {/* Live indicator */}
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em]">
            <span
              className={connected ? "relative w-2.5 h-2.5 rounded-full" : "w-2.5 h-2.5 rounded-full"}
              style={{ background: connected ? "var(--success)" : "var(--text-secondary)" }}
            >
              {connected && (
                <span className="absolute inset-[-4px] rounded-full border-2 border-[var(--success)] opacity-0"
                  style={{ animation: "pulseRing 1.5s ease-out infinite" }} />
              )}
            </span>
            <span style={{ color: connected ? "var(--success)" : "var(--text-secondary)" }}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </header>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes pulseRing {
            0%   { transform: scale(0.85); opacity: 0.8; }
            100% { transform: scale(2.1);  opacity: 0; }
          }
          @keyframes radarRotate {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        }
      `}</style>

      {/* ── Main 2-col grid ── */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 items-start">

        {/* Command panel */}
        <section
          className="rounded-xl p-5 hover:shadow-[var(--accent-glow)] transition-shadow"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          aria-label="Command dispatch"
        >
          <h2 className="text-[11px] tracking-[0.22em] uppercase font-semibold mb-5"
            style={{ color: "var(--text-secondary)" }}>
            Command Dispatch
          </h2>
          <CommandPanel
            motorStatus={telemetry.motor_status}
            lastCmd={lastCmd_}
            sendStatus={sendStatus}
            onSend={sendCommand}
            onEStop={sendEStop}
          />
        </section>

        {/* Telemetry panel */}
        <section
          className="rounded-xl p-5 hover:shadow-[var(--accent-glow)] transition-shadow relative overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          aria-label="Live telemetry"
        >
          {/* Radar scan arc */}
          <div
            className="absolute -top-9 -right-9 w-28 h-28 rounded-full pointer-events-none opacity-25"
            style={{
              background: "conic-gradient(var(--accent) 0deg, rgba(0,212,255,0.12) 48deg, transparent 48deg)",
              animation: "radarRotate 2s linear infinite",
            }}
          />
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] tracking-[0.22em] uppercase font-semibold"
              style={{ color: "var(--text-secondary)" }}>
              Live Telemetry
            </h2>
            <span
              className="font-mono text-[10px] font-bold px-2 py-1 rounded border"
              style={{
                ...(telemetry.motor_status === "IDLE"
                  ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" }
                  : telemetry.motor_status === "MOVING"
                    ? { color: "var(--warning)", borderColor: "var(--warning)", background: "rgba(255,184,0,0.1)" }
                    : { color: "var(--error)", borderColor: "var(--error)", background: "rgba(255,68,68,0.1)" }),
              }}
            >
              {telemetry.motor_status}
            </span>
          </div>
          <TelemetryPanel telemetry={telemetry} />
          <div
            className="mt-4 pt-3 font-mono text-[10px] tracking-wide"
            style={{
              borderTop: "1px solid var(--border)",
              color: connected ? "var(--text-secondary)" : "var(--error)",
            }}
          >
            {connected ? "● Firebase connected" : "● Connection lost — retrying…"}
          </div>
        </section>

      </main>

      {/* ── Crane Animation Panel (full width, second row) ── */}
      <div className="px-6 pb-6">
        <CraneAnimationPanel history={history} />
      </div>

      {/* ── Status bar ── */}
      <footer
        className="flex items-center gap-2 flex-wrap px-6 py-2 font-mono text-[11px]"
        style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}
        aria-label="Status summary"
      >
        <span>
          Last command:{" "}
          {lastCmd_
            ? <span style={{ color: "var(--text-primary)" }}>
                {lastCmd_.command_id}
              </span>
            : "—"
          }
          {lastCmd_ && <span style={{ color: "var(--text-secondary)" }}>
            {" "}· θ {lastCmd_.target_theta}°  R {Number(lastCmd_.target_R).toFixed(2)} cm  H {Number(lastCmd_.target_H).toFixed(2)} cm
          </span>}
        </span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span>System: {telemetry.system_status}</span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span>Motor: {telemetry.motor_status}</span>
        {telemetry.last_updated && (
          <>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>{new Date(telemetry.last_updated).toLocaleTimeString()}</span>
          </>
        )}
      </footer>
    </div>
  );
}

// ── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  function toggle() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") !== "light";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center p-1.5 rounded-lg border transition-colors"
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
      aria-label="Toggle light/dark mode"
    >
      {/* Moon icon (shown in dark mode) */}
      <svg className="dark-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
      </svg>
    </button>
  );
}
