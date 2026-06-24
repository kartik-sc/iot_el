"use client";

import { useEffect, useRef, useState } from "react";
import type { CraneCommand } from "@/types/crane";
import { CRANE_LIMITS } from "@/types/crane";

interface Props {
  history: CraneCommand[];
}

// ── Elevation SVG geometry ────────────────────────────────────────
const EW           = 460;
const EH           = 262;
const GROUND_Y     = 244;
const MAST_X       = 100;
const APEX_Y       = 34;
const BOOM_Y       = APEX_Y + 14;    // boom sits just below apex
const BOOM_PX      = 272;            // full R_max mapped to pixels
const CJIB_PX      = 52;             // counter-jib length
const ROPE_MAX_PX  = GROUND_Y - BOOM_Y - 20;

// ── Top-down inset ────────────────────────────────────────────────
const TD = 82;
const TC = TD / 2;
const TR = 33;

const MAX_R = CRANE_LIMITS.R.max;
const MAX_H = CRANE_LIMITS.H.max;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rToPx(r: number) { return (r / MAX_R) * BOOM_PX; }
function hToPx(h: number) { return (h / MAX_H) * ROPE_MAX_PX; }

export function CraneAnimationPanel({ history }: Props) {
  const latest = history[0] ?? null;

  // Smooth position via rAF LERP — tracks operator intent, not telemetry
  const targetRef = useRef({ R: 0, H: 0, theta: 0 });
  const [pos, setPos] = useState({ R: 0, H: 0, theta: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (latest) {
      targetRef.current = {
        R: latest.target_R,
        H: latest.target_H,
        theta: latest.target_theta,
      };
    }
  }, [latest]);

  useEffect(() => {
    function tick() {
      setPos(prev => ({
        R:     lerp(prev.R,     targetRef.current.R,     0.07),
        H:     lerp(prev.H,     targetRef.current.H,     0.07),
        theta: lerp(prev.theta, targetRef.current.theta, 0.07),
      }));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Derived coordinates ───────────────────────────────────────
  const trolleyX = MAST_X + rToPx(pos.R);
  const ropeLen  = Math.max(8, hToPx(pos.H));
  const hookY    = BOOM_Y + ropeLen;

  const thetaRad = (pos.theta * Math.PI) / 180;
  const tdTx = TC + (pos.R / MAX_R) * TR * Math.cos(thetaRad);
  const tdTy = TC - (pos.R / MAX_R) * TR * Math.sin(thetaRad);

  const labelTheta = latest?.target_theta ?? 0;
  const labelR     = Number(latest?.target_R ?? 0).toFixed(1);
  const labelH     = Number(latest?.target_H ?? 0).toFixed(1);

  return (
    <div
      className="rounded-xl p-5 hover:shadow-[var(--accent-glow)] transition-shadow"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] tracking-[0.22em] uppercase font-semibold"
          style={{ color: "var(--text-secondary)" }}>
          Crane View
        </span>
        {latest && (
          <span className="font-mono text-[10px]" style={{ color: "var(--text-mono)" }}>
            θ {labelTheta}°&nbsp;&nbsp;R {labelR} cm&nbsp;&nbsp;H {labelH} cm
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] font-mono text-[13px] italic"
          style={{ color: "var(--text-secondary)" }}>
          Awaiting first command…
        </div>
      ) : (
        <div className="flex gap-6 items-start" style={{ overflowX: "auto" }}>

          {/* ── Side elevation ──────────────────────────────────── */}
          <svg
            width={EW} height={EH}
            viewBox={`0 0 ${EW} ${EH}`}
            style={{ flexShrink: 0 }}
            aria-label="Crane side elevation"
          >
            {/* Ground */}
            <line x1={14} y1={GROUND_Y} x2={EW - 14} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="2" />
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i}
                x1={22 + i * 25} y1={GROUND_Y}
                x2={14 + i * 25} y2={GROUND_Y + 7}
                stroke="var(--border)" strokeWidth="1" opacity="0.4" />
            ))}

            {/* Mast body */}
            <rect
              x={MAST_X - 5} y={APEX_Y + 6}
              width={10} height={GROUND_Y - APEX_Y - 6}
              fill="var(--accent)" opacity="0.82" rx="1"
            />
            {/* Mast lattice braces */}
            {Array.from({ length: 6 }, (_, i) => {
              const y0 = APEX_Y + 14 + i * 34;
              const y1 = Math.min(y0 + 34, GROUND_Y);
              return (
                <g key={i} opacity="0.28">
                  <line x1={MAST_X - 5} y1={y0} x2={MAST_X + 5} y2={y1}
                    stroke="var(--accent)" strokeWidth="0.9" />
                  <line x1={MAST_X + 5} y1={y0} x2={MAST_X - 5} y2={y1}
                    stroke="var(--accent)" strokeWidth="0.9" />
                </g>
              );
            })}

            {/* Counter-jib */}
            <rect
              x={MAST_X - CJIB_PX - 5} y={BOOM_Y - 4}
              width={CJIB_PX} height={7}
              fill="var(--accent)" opacity="0.55" rx="1"
            />
            <line x1={MAST_X} y1={APEX_Y}
              x2={MAST_X - CJIB_PX} y2={BOOM_Y}
              stroke="var(--accent)" strokeWidth="0.9" opacity="0.38" />
            {/* Counter-weight */}
            <rect
              x={MAST_X - CJIB_PX - 18} y={BOOM_Y - 8}
              width={15} height={15}
              fill="var(--text-secondary)" opacity="0.4" rx="2"
            />

            {/* Support cable: apex → boom tip */}
            <line x1={MAST_X} y1={APEX_Y}
              x2={MAST_X + BOOM_PX} y2={BOOM_Y}
              stroke="var(--accent)" strokeWidth="0.9" opacity="0.42" />

            {/* Boom */}
            <rect
              x={MAST_X} y={BOOM_Y - 4}
              width={BOOM_PX} height={8}
              fill="var(--accent)" opacity="0.82" rx="1"
            />

            {/* Boom distance ticks */}
            {[0.25, 0.5, 0.75, 1.0].map(f => (
              <g key={f}>
                <line
                  x1={MAST_X + f * BOOM_PX} y1={BOOM_Y + 4}
                  x2={MAST_X + f * BOOM_PX} y2={BOOM_Y + 11}
                  stroke="var(--text-secondary)" strokeWidth="0.8" opacity="0.38"
                />
                <text
                  x={MAST_X + f * BOOM_PX} y={BOOM_Y + 20}
                  textAnchor="middle" fontSize="7"
                  fill="var(--text-secondary)" opacity="0.42"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {Math.round(f * MAX_R)}
                </text>
              </g>
            ))}
            <text
              x={MAST_X + BOOM_PX / 2} y={BOOM_Y + 30}
              textAnchor="middle" fontSize="6.5"
              fill="var(--text-secondary)" opacity="0.32"
              fontFamily="JetBrains Mono, monospace"
            >
              R (cm)
            </text>

            {/* Apex cap + halo */}
            <circle cx={MAST_X} cy={APEX_Y} r={9} fill="none"
              stroke="var(--accent)" strokeWidth="0.8" opacity="0.28" />
            <circle cx={MAST_X} cy={APEX_Y} r={5} fill="var(--accent)" />

            {/* ── Trolley (LERP'd position along boom) ── */}
            {/* Wheels */}
            <circle cx={trolleyX - 5} cy={BOOM_Y + 5} r={3.2}
              fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.3" />
            <circle cx={trolleyX + 5} cy={BOOM_Y + 5} r={3.2}
              fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.3" />
            {/* Body */}
            <rect
              x={trolleyX - 9} y={BOOM_Y - 10} width={18} height={11}
              fill="var(--accent)" rx="2"
            />

            {/* Rope */}
            <line
              x1={trolleyX} y1={BOOM_Y + 5}
              x2={trolleyX} y2={hookY}
              stroke="var(--text-secondary)" strokeWidth="1.5" opacity="0.65"
            />

            {/* Hook shank */}
            <rect
              x={trolleyX - 1.5} y={hookY - 2}
              width={3} height={8}
              fill="var(--accent)" rx="0.8"
            />
            {/* Hook curve */}
            <path
              d={`M ${trolleyX - 6} ${hookY + 6} Q ${trolleyX - 9} ${hookY + 16} ${trolleyX} ${hookY + 16} Q ${trolleyX + 7} ${hookY + 16} ${trolleyX + 7} ${hookY + 8}`}
              stroke="var(--accent)" strokeWidth="2.3" fill="none" strokeLinecap="round"
            />

            {/* H scale — right edge */}
            <line
              x1={EW - 26} y1={BOOM_Y} x2={EW - 26} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4"
            />
            <line x1={EW - 30} y1={BOOM_Y}   x2={EW - 22} y2={BOOM_Y}
              stroke="var(--border)" strokeWidth="0.8" opacity="0.4" />
            <line x1={EW - 30} y1={GROUND_Y} x2={EW - 22} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="0.8" opacity="0.4" />
            {/* H fill bar */}
            <rect
              x={EW - 29}
              y={GROUND_Y - hToPx(pos.H)}
              width={6}
              height={hToPx(pos.H)}
              fill="var(--accent)" opacity="0.42" rx="1"
            />
            <text
              x={EW - 8} y={(BOOM_Y + GROUND_Y) / 2}
              textAnchor="middle" fontSize="6.5"
              fill="var(--text-secondary)" opacity="0.35"
              fontFamily="JetBrains Mono, monospace"
              transform={`rotate(-90,${EW - 8},${(BOOM_Y + GROUND_Y) / 2})`}
            >
              H (cm)
            </text>
            <text x={EW - 20} y={BOOM_Y - 3}
              textAnchor="end" fontSize="6.5"
              fill="var(--text-secondary)" opacity="0.35"
              fontFamily="JetBrains Mono, monospace"
            >0</text>
            <text x={EW - 20} y={GROUND_Y + 2}
              textAnchor="end" fontSize="6.5"
              fill="var(--text-secondary)" opacity="0.35"
              fontFamily="JetBrains Mono, monospace"
            >{MAX_H}</text>
          </svg>

          {/* ── Right: top-down inset + recent commands ─────────── */}
          <div className="flex flex-col gap-5" style={{ minWidth: 92 }}>

            {/* Top-down inset (shows θ) */}
            <div>
              <div className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5"
                style={{ color: "var(--text-secondary)" }}>
                Top view
              </div>
              <svg width={TD} height={TD} viewBox={`0 0 ${TD} ${TD}`}
                aria-label="Top-down boom direction">
                <circle cx={TC} cy={TC} r={TR} fill="none"
                  stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" />
                <circle cx={TC} cy={TC} r={TR / 2} fill="none"
                  stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
                {[0, 30, 60, 90].map(a => {
                  const r = (a * Math.PI) / 180;
                  return (
                    <line key={a}
                      x1={TC} y1={TC}
                      x2={TC + TR * Math.cos(r)} y2={TC - TR * Math.sin(r)}
                      stroke="var(--border)" strokeWidth="0.6" strokeDasharray="2 2" />
                  );
                })}
                {/* Boom arm */}
                <line
                  x1={TC} y1={TC}
                  x2={TC + TR * Math.cos(thetaRad)}
                  y2={TC - TR * Math.sin(thetaRad)}
                  stroke="var(--accent)" strokeWidth="1.5" opacity="0.5"
                />
                {/* Trolley dot */}
                <circle cx={tdTx} cy={tdTy} r={4}
                  fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="1.5" />
                {/* Pivot */}
                <circle cx={TC} cy={TC} r={3} fill="var(--accent)" />
              </svg>
              <div className="font-mono text-[9px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                θ = {labelTheta}°
              </div>
            </div>

            {/* Recent commands */}
            <div>
              <div className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5"
                style={{ color: "var(--text-secondary)" }}>
                Recent
              </div>
              <div className="space-y-1.5">
                {history.slice(0, 5).map((cmd, i) => (
                  <div
                    key={cmd.command_id}
                    className="font-mono text-[9px] flex gap-1.5"
                    style={{
                      color: i === 0 ? "var(--accent)" : "var(--text-secondary)",
                      opacity: i === 0 ? 1 : 0.5,
                    }}
                  >
                    <span>θ{cmd.target_theta}</span>
                    <span>R{Number(cmd.target_R).toFixed(0)}</span>
                    <span>H{Number(cmd.target_H).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
