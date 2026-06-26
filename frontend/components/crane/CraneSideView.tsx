"use client";

import { useSharedCranePos } from "@/hooks/useSharedCranePos";
import type { CraneCommand, Telemetry } from "@/types/crane";
import { CRANE_LIMITS, VALID_THETA_ANGLES } from "@/types/crane";

interface Props {
  history: CraneCommand[];
  telemetry: Telemetry;
  connected: boolean;
}

// ── SVG geometry ──────────────────────────────────────────────────
const EW       = 360;
const EH       = 210;
const GROUND_Y = 192;
const MAST_X   = 82;
const APEX_Y   = 20;
const BOOM_Y   = APEX_Y + 12;
const BOOM_PX  = 238;          // R_max → pixel span
const CJIB_PX  = 44;           // counter-jib length
const ROPE_MAX = GROUND_Y - BOOM_Y - 16;

// Top-down inset
const TD = 78, TC = TD / 2, TR = 28;

const MAX_R = CRANE_LIMITS.R.max;
const MAX_H = CRANE_LIMITS.H.max;

function rToPx(r: number) { return (r / MAX_R) * BOOM_PX; }
function hToPx(h: number) { return (h / MAX_H) * ROPE_MAX; }

export function CraneSideView({ history, telemetry, connected }: Props) {
  // Merges live telemetry (when online) with command history (optimistic offline).
  // Runs its own rAF LERP loop so re-renders stay scoped to this component.
  const pos = useSharedCranePos(telemetry, connected, history[0] ?? null);

  const trolleyX = MAST_X + rToPx(pos.R);
  const ropeLen  = Math.max(8, hToPx(pos.H));
  const hookY    = BOOM_Y + ropeLen;
  const thetaRad = (pos.theta * Math.PI) / 180;
  const tdTx     = TC + (pos.R / MAX_R) * TR * Math.cos(thetaRad);
  const tdTy     = TC - (pos.R / MAX_R) * TR * Math.sin(thetaRad);

  const labelTheta = Math.round(pos.theta);
  const labelR     = pos.R.toFixed(1);
  const labelH     = pos.H.toFixed(1);

  return (
    <div
      className="rounded-xl p-4 hover:shadow-[var(--accent-glow)] transition-shadow flex flex-col h-full"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] tracking-[0.22em] uppercase font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Side Elevation
        </span>
        {history.length > 0 && (
          <span className="font-mono text-[10px]" style={{ color: "var(--text-mono)" }}>
            θ {labelTheta}°&nbsp;&nbsp;R {labelR} cm&nbsp;&nbsp;H {labelH} cm
          </span>
        )}
      </div>

      {history.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center font-mono text-[13px] italic"
          style={{ color: "var(--text-secondary)" }}
        >
          Awaiting first command…
        </div>
      ) : (
        <div className="flex gap-4 items-start" style={{ overflowX: "auto" }}>

          {/* ── Side elevation SVG ──────────────────────────────── */}
          <svg
            width={EW} height={EH}
            viewBox={`0 0 ${EW} ${EH}`}
            style={{ flexShrink: 0 }}
            aria-label="Crane side elevation"
          >
            {/* Ground + hatch */}
            <line x1={12} y1={GROUND_Y} x2={EW - 12} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="2" />
            {Array.from({ length: 15 }, (_, i) => (
              <line key={i}
                x1={20 + i * 23} y1={GROUND_Y}
                x2={12 + i * 23} y2={GROUND_Y + 7}
                stroke="var(--border)" strokeWidth="1" opacity="0.3" />
            ))}

            {/* Mast body */}
            <rect
              x={MAST_X - 4} y={APEX_Y + 4}
              width={9} height={GROUND_Y - APEX_Y - 4}
              fill="var(--accent)" opacity="0.82" rx="1"
            />
            {/* Mast lattice braces */}
            {Array.from({ length: 5 }, (_, i) => {
              const y0 = APEX_Y + 14 + i * 34;
              const y1 = Math.min(y0 + 34, GROUND_Y);
              return (
                <g key={i} opacity="0.22">
                  <line x1={MAST_X - 4} y1={y0} x2={MAST_X + 5} y2={y1}
                    stroke="var(--accent)" strokeWidth="0.9" />
                  <line x1={MAST_X + 5} y1={y0} x2={MAST_X - 4} y2={y1}
                    stroke="var(--accent)" strokeWidth="0.9" />
                </g>
              );
            })}

            {/* Counter-jib */}
            <rect
              x={MAST_X - CJIB_PX - 4} y={BOOM_Y - 3}
              width={CJIB_PX} height={6}
              fill="var(--accent)" opacity="0.5" rx="1"
            />
            <line x1={MAST_X} y1={APEX_Y}
              x2={MAST_X - CJIB_PX} y2={BOOM_Y}
              stroke="var(--accent)" strokeWidth="0.9" opacity="0.32" />
            {/* Counter-weight block */}
            <rect
              x={MAST_X - CJIB_PX - 16} y={BOOM_Y - 7}
              width={13} height={12}
              fill="var(--text-secondary)" opacity="0.3" rx="2"
            />

            {/* Support cable: apex → boom tip */}
            <line x1={MAST_X} y1={APEX_Y}
              x2={MAST_X + BOOM_PX} y2={BOOM_Y}
              stroke="var(--accent)" strokeWidth="0.9" opacity="0.36" />

            {/* Boom */}
            <rect
              x={MAST_X} y={BOOM_Y - 4}
              width={BOOM_PX} height={7}
              fill="var(--accent)" opacity="0.82" rx="1"
            />

            {/* Boom R-axis tick marks */}
            {[0.25, 0.5, 0.75, 1.0].map(f => (
              <g key={f}>
                <line
                  x1={MAST_X + f * BOOM_PX} y1={BOOM_Y + 4}
                  x2={MAST_X + f * BOOM_PX} y2={BOOM_Y + 9}
                  stroke="var(--text-secondary)" strokeWidth="0.8" opacity="0.32"
                />
                <text
                  x={MAST_X + f * BOOM_PX} y={BOOM_Y + 18}
                  textAnchor="middle" fontSize="6.5"
                  fill="var(--text-secondary)" opacity="0.38"
                  fontFamily="monospace"
                >
                  {Math.round(f * MAX_R)}
                </text>
              </g>
            ))}
            <text
              x={MAST_X + BOOM_PX / 2} y={BOOM_Y + 27}
              textAnchor="middle" fontSize="6"
              fill="var(--text-secondary)" opacity="0.28"
              fontFamily="monospace"
            >
              R (cm)
            </text>

            {/* Apex cap */}
            <circle cx={MAST_X} cy={APEX_Y} r={7} fill="none"
              stroke="var(--accent)" strokeWidth="0.8" opacity="0.22" />
            <circle cx={MAST_X} cy={APEX_Y} r={4} fill="var(--accent)" />

            {/* Trolley wheels */}
            <circle cx={trolleyX - 4} cy={BOOM_Y + 4} r={2.8}
              fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.2" />
            <circle cx={trolleyX + 4} cy={BOOM_Y + 4} r={2.8}
              fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="1.2" />
            {/* Trolley body */}
            <rect
              x={trolleyX - 7} y={BOOM_Y - 9} width={15} height={10}
              fill="var(--accent)" rx="2"
            />

            {/* Rope */}
            <line
              x1={trolleyX} y1={BOOM_Y + 5}
              x2={trolleyX} y2={hookY}
              stroke="var(--text-secondary)" strokeWidth="1.3" opacity="0.55"
            />

            {/* Hook shank */}
            <rect
              x={trolleyX - 1.5} y={hookY - 2}
              width={3} height={7}
              fill="var(--accent)" rx="0.8"
            />
            {/* Hook J-curve */}
            <path
              d={`M ${trolleyX - 5} ${hookY + 5} Q ${trolleyX - 8} ${hookY + 13} ${trolleyX} ${hookY + 13} Q ${trolleyX + 6} ${hookY + 13} ${trolleyX + 6} ${hookY + 6}`}
              stroke="var(--accent)" strokeWidth="2.1" fill="none" strokeLinecap="round"
            />

            {/* H scale bar (right edge) */}
            <line
              x1={EW - 20} y1={BOOM_Y} x2={EW - 20} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.38"
            />
            <line x1={EW - 24} y1={BOOM_Y}   x2={EW - 16} y2={BOOM_Y}
              stroke="var(--border)" strokeWidth="0.8" opacity="0.32" />
            <line x1={EW - 24} y1={GROUND_Y} x2={EW - 16} y2={GROUND_Y}
              stroke="var(--border)" strokeWidth="0.8" opacity="0.32" />
            {/* H fill */}
            <rect
              x={EW - 23}
              y={GROUND_Y - hToPx(pos.H)}
              width={5}
              height={Math.max(0, hToPx(pos.H))}
              fill="var(--accent)" opacity="0.38" rx="1"
            />
            <text
              x={EW - 5} y={(BOOM_Y + GROUND_Y) / 2}
              textAnchor="middle" fontSize="5.5"
              fill="var(--text-secondary)" opacity="0.28"
              fontFamily="monospace"
              transform={`rotate(-90,${EW - 5},${(BOOM_Y + GROUND_Y) / 2})`}
            >
              H (cm)
            </text>
          </svg>

          {/* ── Right column: top-down + recent commands ─────── */}
          <div className="flex flex-col gap-4" style={{ minWidth: 86 }}>

            {/* Top-down compass */}
            <div>
              <div
                className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Top View
              </div>
              <svg width={TD} height={TD} viewBox={`0 0 ${TD} ${TD}`}
                aria-label="Top-down boom direction">
                {/* Range rings */}
                <circle cx={TC} cy={TC} r={TR} fill="none"
                  stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" />
                <circle cx={TC} cy={TC} r={TR / 2} fill="none"
                  stroke="var(--border)" strokeWidth="0.5" opacity="0.45" />
                {/* Valid angle guide lines */}
                {VALID_THETA_ANGLES.map(a => {
                  const r = (a * Math.PI) / 180;
                  return (
                    <line key={a}
                      x1={TC} y1={TC}
                      x2={TC + TR * Math.cos(r)}
                      y2={TC - TR * Math.sin(r)}
                      stroke="var(--border)" strokeWidth="0.6" strokeDasharray="2 2"
                    />
                  );
                })}
                {/* Boom arm */}
                <line
                  x1={TC} y1={TC}
                  x2={TC + TR * Math.cos(thetaRad)}
                  y2={TC - TR * Math.sin(thetaRad)}
                  stroke="var(--accent)" strokeWidth="1.5" opacity="0.55"
                />
                {/* Trolley dot */}
                <circle cx={tdTx} cy={tdTy} r={3.5}
                  fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="1.5" />
                {/* Pivot */}
                <circle cx={TC} cy={TC} r={2.5} fill="var(--accent)" />
              </svg>
              <div
                className="font-mono text-[9px] mt-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                θ = {labelTheta}°
              </div>
            </div>

            {/* Recent commands */}
            <div>
              <div
                className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
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
