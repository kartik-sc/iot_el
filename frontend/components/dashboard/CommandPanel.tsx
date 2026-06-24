"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  cylindricalToCartesian,
  cartesianToCylindrical,
  type Cylindrical,
  type Cartesian,
} from "@/lib/coordConverter";
import type { CraneCommand, MotorStatus } from "@/types/crane";
import { VALID_THETA_ANGLES } from "@/types/crane";

interface CommandPanelProps {
  motorStatus: MotorStatus;
  lastCmd: CraneCommand | null;
  sendStatus: "idle" | "sending" | "success" | "error";
  onSend: (theta: number, R: number, H: number) => Promise<void>;
  onEStop: () => Promise<void>;
}

type Mode = "cartesian" | "cylindrical";

const FIELD = [
  "w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3.5 py-2.5",
  "font-mono text-[15px] text-[var(--text-primary)] outline-none appearance-none",
  "transition-[border-color,box-shadow] duration-200",
  "focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]",
  "placeholder:text-[var(--text-secondary)] placeholder:opacity-65",
].join(" ");

export function CommandPanel({ motorStatus, lastCmd, sendStatus, onSend, onEStop }: CommandPanelProps) {
  const [mode, setMode] = useState<Mode>("cartesian");

  // Cartesian inputs
  const [cx, setCx] = useState("");
  const [cy, setCy] = useState("");
  const [cz, setCz] = useState("");

  // Cylindrical inputs
  const [cTheta, setCTheta] = useState("");
  const [cR, setCR] = useState("");
  const [cH, setCH] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<{
    theta: number; R: number; H: number;
    x: number; y: number; z: number;
    snapped: boolean; rawTheta: number;
  } | null>(null);

  // Shake tracking
  const [shakeKeys, setShakeKeys] = useState({ cx: 0, cy: 0, cz: 0, cTheta: 0, cR: 0, cH: 0 });

  const x = parseFloat(cx), y = parseFloat(cy), z = parseFloat(cz);
  const theta = cTheta !== "" ? parseInt(cTheta, 10) : NaN;
  const R = parseFloat(cR), H = parseFloat(cH);

  const xOk = cx !== "" && !isNaN(x);
  const yOk = cy !== "" && !isNaN(y);
  const zOk = cz !== "" && !isNaN(z);
  const thetaOk = cTheta !== "" && !isNaN(theta);
  const ROk = cR !== "" && !isNaN(R);
  const HOk = cH !== "" && !isNaN(H);

  const cartValid = xOk && yOk && zOk;
  const cylValid  = thetaOk && ROk && HOk;

  // Live conversion
  const conversion = useMemo(() => {
    if (mode === "cartesian") {
      if (!cartValid) return null;
      const { cyl, thetaRaw, snapped } = cartesianToCylindrical({ x, y, z });
      return { cart: { x, y, z }, cyl, thetaRaw, snapped };
    } else {
      if (!cylValid) return null;
      const cart = cylindricalToCartesian({ theta, R, H });
      return { cart, cyl: { theta, R, H }, thetaRaw: theta, snapped: false };
    }
  }, [mode, cx, cy, cz, cTheta, cR, cH]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(next: Mode) {
    if (next === mode) return;
    setCx(""); setCy(""); setCz("");
    setCTheta(""); setCR(""); setCH("");
    setMode(next);
  }

  function shake(fields: (keyof typeof shakeKeys)[]) {
    setShakeKeys(prev => {
      const next = { ...prev };
      fields.forEach(f => { next[f] = prev[f] + 1; });
      return next;
    });
  }

  function validate(): boolean {
    if (mode === "cartesian") {
      const bad: (keyof typeof shakeKeys)[] = [];
      if (!xOk) bad.push("cx");
      if (!yOk) bad.push("cy");
      if (!zOk) bad.push("cz");
      if (bad.length) { shake(bad); return false; }
    } else {
      const bad: (keyof typeof shakeKeys)[] = [];
      if (!thetaOk) bad.push("cTheta");
      if (!ROk)     bad.push("cR");
      if (!HOk)     bad.push("cH");
      if (bad.length) { shake(bad); return false; }
    }
    return true;
  }

  function openDialog() {
    if (!validate()) return;
    if (mode === "cartesian") {
      const { cyl, thetaRaw, snapped } = cartesianToCylindrical({ x, y, z });
      setPending({ theta: cyl.theta, R: cyl.R, H: cyl.H, x, y, z, snapped, rawTheta: thetaRaw });
    } else {
      const cart = cylindricalToCartesian({ theta, R, H });
      setPending({ theta, R, H, x: cart.x, y: cart.y, z: cart.z, snapped: false, rawTheta: theta });
    }
    setDialogOpen(true);
  }

  async function handleConfirm() {
    if (!pending) return;
    setDialogOpen(false);
    await onSend(pending.theta, pending.R, pending.H);
    setCx(""); setCy(""); setCz("");
    setCTheta(""); setCR(""); setCH("");
  }

  const isBusy = motorStatus === "MOVING" || sendStatus === "sending";

  // Close dialog on Escape
  useEffect(() => {
    if (!dialogOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDialogOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialogOpen]);

  return (
    <>
      {/* Mode toggle */}
      <div className="flex p-[3px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full mb-5">
        {(["cartesian", "cylindrical"] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={[
              "flex-1 py-[7px] px-2 rounded-full text-[11px] font-semibold tracking-[0.07em] uppercase",
              "transition-all duration-200",
              mode === m
                ? "bg-[var(--accent)] text-black shadow-[var(--accent-glow)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {m === "cartesian" ? "CARTESIAN  x · y · z" : "CYLINDRICAL  θ · R · H"}
          </button>
        ))}
      </div>

      {/* Inputs */}
      {mode === "cartesian" ? (
        <div className="space-y-4 mb-4">
          <ShakeField shakeKey={shakeKeys.cx} label={<><Accent>x</Accent> — Horizontal distance along boom direction</>}>
            <input className={FIELD} type="number" step="any" placeholder="cm" value={cx}
              onChange={e => setCx(e.target.value)} />
          </ShakeField>
          <ShakeField shakeKey={shakeKeys.cy} label={<><Accent>y</Accent> — Horizontal distance perpendicular to boom</>}>
            <input className={FIELD} type="number" step="any" placeholder="cm" value={cy}
              onChange={e => setCy(e.target.value)} />
          </ShakeField>
          <ShakeField shakeKey={shakeKeys.cz} label={<><Accent>z</Accent> — Hook height (vertical)</>}>
            <input className={FIELD} type="number" step="any" placeholder="cm" value={cz}
              onChange={e => setCz(e.target.value)} />
          </ShakeField>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          <ShakeField shakeKey={shakeKeys.cTheta} label={<><Accent>θ</Accent> — Boom Angle</>}>
            <select className={FIELD + " cursor-pointer pr-9"} value={cTheta}
              onChange={e => setCTheta(e.target.value)}
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b8ca8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.875rem center" }}>
              <option value="">— select angle —</option>
              {VALID_THETA_ANGLES.map(a => (
                <option key={a} value={a}>{a}°</option>
              ))}
            </select>
          </ShakeField>
          <ShakeField shakeKey={shakeKeys.cR} label={<><Accent>R</Accent> — Trolley Distance</>}>
            <input className={FIELD} type="number" step="any" placeholder="cm from pivot" value={cR}
              onChange={e => setCR(e.target.value)} />
          </ShakeField>
          <ShakeField shakeKey={shakeKeys.cH} label={<><Accent>H</Accent> — Hook Height</>}>
            <input className={FIELD} type="number" step="any" placeholder="cm" value={cH}
              onChange={e => setCH(e.target.value)} />
          </ShakeField>
        </div>
      )}

      {/* Live conversion preview */}
      <ConversionPreview mode={mode} conversion={conversion} />

      {/* Review & Send */}
      <button
        onClick={openDialog}
        disabled={isBusy}
        className={[
          "w-full py-3.5 rounded-lg font-bold text-[14px] tracking-[0.1em] uppercase mt-1",
          "transition-all duration-200",
          isBusy
            ? "opacity-45 cursor-not-allowed bg-[var(--accent)] text-black"
            : sendStatus === "success"
              ? "bg-[var(--success)] text-black"
              : sendStatus === "error"
                ? "bg-[var(--error)] text-white"
                : "bg-[var(--accent)] text-black hover:brightness-110",
        ].join(" ")}
      >
        {sendStatus === "success"
          ? "✓ DISPATCHED"
          : sendStatus === "error"
            ? "✗ FAILED — check connection"
            : "REVIEW & SEND ▶"}
      </button>

      {/* Last sent */}
      <div className="mt-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3.5 font-mono text-[12px] leading-loose min-h-[84px]">
        {lastCmd ? (
          <>
            <div><span className="text-[var(--text-secondary)]">CMD&nbsp;&nbsp;</span><span className="text-[var(--accent)]">{lastCmd.command_id}</span></div>
            <div>
              <span className="text-[var(--text-secondary)]">θ&nbsp;</span>
              <span className="text-[var(--accent)]">{lastCmd.target_theta}°</span>
              <span className="text-[var(--text-secondary)]">&nbsp;&nbsp;&nbsp;R&nbsp;</span>
              <span className="text-[var(--accent)]">{Number(lastCmd.target_R).toFixed(2)} cm</span>
              <span className="text-[var(--text-secondary)]">&nbsp;&nbsp;&nbsp;H&nbsp;</span>
              <span className="text-[var(--accent)]">{Number(lastCmd.target_H).toFixed(2)} cm</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">SENT&nbsp;</span>
              <span className="text-[var(--text-primary)]">{new Date(lastCmd.timestamp).toLocaleTimeString()}</span>
            </div>
          </>
        ) : (
          <span className="text-[var(--text-secondary)] opacity-50 text-[11px] italic">No command sent yet.</span>
        )}
      </div>

      {/* Confirmation dialog */}
      {dialogOpen && pending && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/65"
          style={{ animation: "fadeInOverlay 0.2s ease-out" }}
          onClick={e => { if (e.target === e.currentTarget) setDialogOpen(false); }}
        >
          <style>{`
            @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleInCard { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          `}</style>
          <div
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[14px] p-8 max-w-[420px] w-full"
            style={{ animation: "scaleInCard 0.2s ease-out" }}
          >
            <div className="flex items-center gap-2 text-[var(--warning)] font-bold text-sm tracking-[0.08em] mb-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              CONFIRM CRANE MOVEMENT
            </div>

            <div className="grid grid-cols-2 gap-x-6 font-mono text-[13px] mb-4">
              <div>
                <div className="text-[9px] tracking-[0.16em] uppercase text-[var(--text-secondary)] mb-1.5 font-bold">Cartesian</div>
                <DlgRow k="x" v={`${pending.x.toFixed(2)} cm`} />
                <DlgRow k="y" v={`${pending.y.toFixed(2)} cm`} />
                <DlgRow k="z" v={`${pending.z.toFixed(2)} cm`} />
              </div>
              <div>
                <div className="text-[9px] tracking-[0.16em] uppercase text-[var(--text-secondary)] mb-1.5 font-bold">Cylindrical</div>
                <DlgRow k="θ" v={`${pending.theta}°`} />
                <DlgRow k="R" v={`${pending.R.toFixed(2)} cm`} />
                <DlgRow k="H" v={`${pending.H.toFixed(2)} cm`} />
              </div>
            </div>

            {pending.snapped && (
              <div className="font-mono text-[12px] text-[var(--warning)] italic mb-4 px-3 py-2 bg-[rgba(255,184,0,0.08)] border border-[rgba(255,184,0,0.2)] rounded-lg">
                snapped from {pending.rawTheta.toFixed(1)}° — nearest valid: {pending.theta}°
              </div>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-5 py-2.5 bg-transparent border border-[var(--border)] rounded-lg text-[var(--text-secondary)] font-semibold text-[13px] tracking-[0.06em] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                disabled={sendStatus === "sending"}
                className="px-5 py-2.5 bg-[var(--accent)] text-black font-bold text-[13px] tracking-[0.06em] rounded-lg hover:brightness-110 disabled:opacity-55 transition-all"
              >
                {sendStatus === "sending" ? "SENDING…" : "CONFIRM →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Conversion Preview ───────────────────────────────────────────────────────

function ConversionPreview({ mode, conversion }: {
  mode: Mode;
  conversion: { cart: Cartesian; cyl: Cylindrical; thetaRaw: number; snapped: boolean } | null;
}) {
  const cartActive = mode === "cartesian";

  function cartVal(key: keyof Cartesian) {
    if (!conversion) return "—";
    return `${conversion.cart[key].toFixed(2)} cm`;
  }
  function cylVal(key: "theta" | "R" | "H") {
    if (!conversion) return "—";
    if (key === "theta") return `${conversion.cyl.theta}°`;
    return `${conversion.cyl[key].toFixed(2)} cm`;
  }

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3.5 mb-4 font-mono text-[12px]">
      <div className="text-[8px] font-bold tracking-[0.22em] uppercase text-[var(--text-secondary)] mb-2.5">
        Coordinate Preview
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--text-secondary)] mb-1.5">Cartesian</div>
          {(["x", "y", "z"] as const).map(k => (
            <div key={k} className="flex gap-1.5 mb-0.5">
              <span className="text-[var(--text-secondary)] min-w-[1rem]">{k}</span>
              <span className={cartActive && conversion ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}>
                {cartVal(k)}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--text-secondary)] mb-1.5">Cylindrical</div>
          {(["theta", "R", "H"] as const).map(k => (
            <div key={k} className="flex gap-1.5 mb-0.5">
              <span className="text-[var(--text-secondary)] min-w-[1rem]">{k === "theta" ? "θ" : k}</span>
              <span className={!cartActive && conversion ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}>
                {cylVal(k)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {conversion?.snapped && (
        <div className="mt-2 text-[var(--warning)] italic text-[11px]">
          ← snapped from {conversion.thetaRaw.toFixed(1)}°
        </div>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function ShakeField({ shakeKey, label, children }: {
  shakeKey: number;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div key={shakeKey} style={shakeKey > 0 ? { animation: "shake 0.4s ease" } : {}}>
      <style>{`@media (prefers-reduced-motion: no-preference) { @keyframes shake { 0%,100%{transform:translateX(0)} 18%{transform:translateX(-7px)} 36%{transform:translateX(7px)} 54%{transform:translateX(-4px)} 72%{transform:translateX(4px)} } }`}</style>
      <label className="block text-[11px] font-medium tracking-[0.04em] text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--accent)] font-mono font-bold">{children}</span>;
}

function DlgRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 mb-1">
      <span className="text-[var(--text-secondary)] min-w-[1.25rem]">{k}</span>
      <span className="text-[var(--accent)]">{v}</span>
    </div>
  );
}
