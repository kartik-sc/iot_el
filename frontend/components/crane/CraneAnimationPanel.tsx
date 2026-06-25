"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { CraneCommand } from "@/types/crane";
import { CRANE_LIMITS, VALID_THETA_ANGLES } from "@/types/crane";

interface Props {
  history: CraneCommand[];
}

// ── Scale & geometry constants ────────────────────────────────────────────────
// 1 cm = 0.1 world units. Mast is 6u (~60cm) for visual clarity.
const S       = 0.1;
const MAST_H  = 6.0;
const MAX_R_W = CRANE_LIMITS.R.max * S;   // 4.0u
const MAX_H_W = CRANE_LIMITS.H.max * S;   // 3.0u
const CJIB_W  = 1.6;
const ACCENT  = "#00d4ff";

const WHEEL_POS: [number, number, number][] = [
  [-0.1, -0.08, -0.11],
  [ 0.1, -0.08, -0.11],
  [-0.1, -0.08,  0.11],
  [ 0.1, -0.08,  0.11],
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── Inner scene component — runs inside <Canvas>, drives useFrame loop ────────
function CraneMesh({ history }: { history: CraneCommand[] }) {
  const latest = history[0] ?? null;

  // Mutable refs for lerp targets / current state — no re-renders on frame tick
  const targetRef  = useRef({ theta: 0, R: 0, H: 0 });
  const currentRef = useRef({ theta: 0, R: 0, H: 0 });

  // Scene object refs for per-frame mutation
  const pivotRef   = useRef<THREE.Group>(null);
  const trolleyRef = useRef<THREE.Group>(null);
  const hookRef    = useRef<THREE.Group>(null);

  // Rope: imperative primitive so we can update the buffer attribute each frame
  const ropeLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0,  0, -0.1, 0]), 3),
    );
    const mat = new THREE.LineBasicMaterial({ color: "#6b8ca8", opacity: 0.75, transparent: true });
    return new THREE.Line(geo, mat);
  }, []);

  // Swept arc border: static 0–90° arc at boom height
  const sweepArcPts = useMemo<THREE.Vector3[]>(() => {
    const pts = [new THREE.Vector3(0, 0, 0)];
    for (let a = 0; a <= 90; a += 2) {
      const r = (a * Math.PI) / 180;
      pts.push(new THREE.Vector3(MAX_R_W * Math.cos(r), 0, MAX_R_W * Math.sin(r)));
    }
    pts.push(new THREE.Vector3(0, 0, 0));
    return pts;
  }, []);

  useEffect(() => {
    if (latest) {
      targetRef.current = {
        theta: latest.target_theta,
        R: latest.target_R,
        H: latest.target_H,
      };
    }
  }, [latest]);

  useEffect(() => {
    return () => {
      ropeLine.geometry.dispose();
      (ropeLine.material as THREE.Material).dispose();
    };
  }, [ropeLine]);

  // Lerp factor 0.07 matches the original SVG panel
  useFrame(() => {
    const c = currentRef.current;
    const t = targetRef.current;
    c.theta = lerp(c.theta, t.theta, 0.07);
    c.R     = lerp(c.R,     t.R,     0.07);
    c.H     = lerp(c.H,     t.H,     0.07);

    if (pivotRef.current)
      pivotRef.current.rotation.y = -(c.theta * Math.PI / 180);

    if (trolleyRef.current)
      trolleyRef.current.position.x = Math.max(0, Math.min(MAX_R_W, c.R * S));

    const hW = Math.max(0, Math.min(MAX_H_W, c.H * S));

    if (hookRef.current)
      hookRef.current.position.y = -0.085 - hW;

    const pos = ropeLine.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, 0, 0, 0);
    pos.setXYZ(1, 0, -(hW + 0.04), 0);
    pos.needsUpdate = true;
  });

  return (
    <>
      <fog attach="fog" args={["#0a0e17", 20, 80]} />

      {/* Lights */}
      <ambientLight color="#1a2a3a" intensity={2.2} />
      <directionalLight
        color={ACCENT} intensity={0.9} position={[6, 12, 6]}
        castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      />
      <directionalLight color="#001833" intensity={0.6} position={[-6, 4, -6]} />

      {/* Ground plane + grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#080c14" roughness={1} />
      </mesh>
      <gridHelper args={[40, 40, "#1e2d45", "#1e2d45"]} />

      {/* Base plate */}
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.14, 1.4]} />
        <meshStandardMaterial color="#1a2236" roughness={0.7} metalness={0.6} />
      </mesh>

      {/* Mast */}
      <mesh position={[0, MAST_H / 2 + 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, MAST_H, 10]} />
        <meshStandardMaterial color="#243448" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Accent rings on mast */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.6 + (i * (MAST_H - 0.6)) / 6 + 0.14, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.13, 0.016, 6, 14]} />
          <meshStandardMaterial
            color={ACCENT} emissive={ACCENT} emissiveIntensity={0.12}
            roughness={0.3} metalness={0.9}
          />
        </mesh>
      ))}

      {/* Swept volume: 0–90° ring at boom height */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, MAST_H + 0.14, 0]}>
        <ringGeometry args={[0.1, MAX_R_W, 64, 1, 0, Math.PI / 2]} />
        <meshBasicMaterial color={ACCENT} opacity={0.055} transparent side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={sweepArcPts} color={ACCENT}
        opacity={0.22} transparent lineWidth={1}
        position={[0, MAST_H + 0.14, 0]}
      />

      {/* Boom pivot — yaws around Y with θ */}
      <group ref={pivotRef} position={[0, MAST_H + 0.14, 0]}>

        {/* Apex cap */}
        <mesh castShadow>
          <sphereGeometry args={[0.2, 14, 10]} />
          <meshStandardMaterial color={ACCENT} roughness={0.2} metalness={0.9} emissive={ACCENT} emissiveIntensity={0.3} />
        </mesh>

        {/* Jib (boom) */}
        <mesh position={[MAX_R_W / 2, 0, 0]} castShadow>
          <boxGeometry args={[MAX_R_W, 0.1, 0.16]} />
          <meshStandardMaterial color={ACCENT} roughness={0.3} metalness={0.8} emissive={ACCENT} emissiveIntensity={0.06} />
        </mesh>
        <Line
          points={[new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(MAX_R_W, -0.05, 0)]}
          color={ACCENT} opacity={0.35} transparent lineWidth={1}
        />

        {/* Counter-jib + weight */}
        <mesh position={[-CJIB_W / 2 - 0.04, 0, 0]}>
          <boxGeometry args={[CJIB_W, 0.09, 0.13]} />
          <meshStandardMaterial color="#243448" roughness={0.7} metalness={0.5} />
        </mesh>
        <mesh position={[-CJIB_W - 0.12, -0.11, 0]} castShadow>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshStandardMaterial color="#1a2236" roughness={0.8} metalness={0.5} />
        </mesh>
        <Line
          points={[new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(-CJIB_W, -0.05, 0)]}
          color={ACCENT} opacity={0.28} transparent lineWidth={1}
        />

        {/* Trolley — translates along boom +X */}
        <group ref={trolleyRef} position={[0, -0.08, 0]}>

          {/* Body */}
          <mesh castShadow>
            <boxGeometry args={[0.26, 0.17, 0.28]} />
            <meshStandardMaterial color={ACCENT} roughness={0.2} metalness={0.9} emissive={ACCENT} emissiveIntensity={0.2} />
          </mesh>

          {/* Wheels */}
          {WHEEL_POS.map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.06, 8]} />
              <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}

          <pointLight color={ACCENT} intensity={0.6} distance={2.5} />

          {/* Rope: buffer updated each frame via useFrame */}
          <primitive object={ropeLine} position={[0, -0.085, 0]} />

          {/* Hook: position.y driven by useFrame */}
          <group ref={hookRef} position={[0, -0.085, 0]}>
            <mesh>
              <cylinderGeometry args={[0.024, 0.024, 0.1, 6]} />
              <meshStandardMaterial color={ACCENT} roughness={0.3} metalness={0.9} emissive={ACCENT} emissiveIntensity={0.08} />
            </mesh>
            <mesh position={[0.05, -0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.085, 0.024, 6, 14, Math.PI]} />
              <meshStandardMaterial color={ACCENT} roughness={0.3} metalness={0.9} emissive={ACCENT} emissiveIntensity={0.06} />
            </mesh>
          </group>

        </group>
      </group>

      <OrbitControls
        target={[0, MAST_H * 0.42, 0]}
        enableDamping dampingFactor={0.08}
        minDistance={3} maxDistance={28}
        maxPolarAngle={Math.PI * 0.47}
      />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
// `mounted` guards SSR: Three.js needs WebGL which doesn't exist in Node.
export function CraneAnimationPanel({ history }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const latest     = history[0] ?? null;
  const labelTheta = latest?.target_theta ?? 0;
  const labelR     = Number(latest?.target_R ?? 0).toFixed(1);
  const labelH     = Number(latest?.target_H ?? 0).toFixed(1);

  // Top-down inset overlay values (snapshots from latest command, not lerped)
  const thetaRad = (labelTheta * Math.PI) / 180;
  const rNorm    = Number(latest?.target_R ?? 0) / CRANE_LIMITS.R.max;
  const TD = 82, TC = TD / 2, TR = 33;
  const tdTx = TC + rNorm * TR * Math.cos(thetaRad);
  const tdTy = TC - rNorm * TR * Math.sin(thetaRad);

  return (
    <div
      className="rounded-xl overflow-hidden hover:shadow-[var(--accent-glow)] transition-shadow"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", height: "420px", position: "relative" }}
    >
      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3"
        style={{ background: "rgba(17,24,39,0.85)", backdropFilter: "blur(4px)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[11px] tracking-[0.22em] uppercase font-semibold" style={{ color: "var(--text-secondary)" }}>
          Crane View
        </span>
        {latest && (
          <span className="font-mono text-[10px]" style={{ color: "var(--text-mono)" }}>
            θ {labelTheta}°&nbsp;&nbsp;R {labelR} cm&nbsp;&nbsp;H {labelH} cm
          </span>
        )}
      </div>

      {/* 3D Canvas — deferred until client mount to avoid SSR WebGL errors */}
      {mounted ? (
        <Canvas
          camera={{ position: [9, 7, 9], fov: 48, near: 0.1, far: 200 }}
          shadows
          gl={{ antialias: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <CraneMesh history={history} />
        </Canvas>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-[13px] italic"
          style={{ color: "var(--text-secondary)", paddingTop: "44px" }}
        >
          Loading 3D scene…
        </div>
      )}

      {/* Top-down inset — same as original, HTML overlay over canvas */}
      <div className="absolute bottom-4 right-4 z-10" style={{ pointerEvents: "none" }}>
        <div className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Top view
        </div>
        <svg
          width={TD} height={TD} viewBox={`0 0 ${TD} ${TD}`}
          aria-label="Top-down boom direction"
          style={{ background: "rgba(17,24,39,0.8)", borderRadius: 8, border: "1px solid var(--border)" }}
        >
          <circle cx={TC} cy={TC} r={TR} fill="none" stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx={TC} cy={TC} r={TR / 2} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
          {VALID_THETA_ANGLES.map(a => {
            const r = (a * Math.PI) / 180;
            return (
              <line key={a}
                x1={TC} y1={TC}
                x2={TC + TR * Math.cos(r)} y2={TC - TR * Math.sin(r)}
                stroke="var(--border)" strokeWidth="0.6" strokeDasharray="2 2"
              />
            );
          })}
          <line x1={TC} y1={TC}
            x2={TC + TR * Math.cos(thetaRad)}
            y2={TC - TR * Math.sin(thetaRad)}
            stroke="var(--accent)" strokeWidth="1.5" opacity="0.5"
          />
          <circle cx={tdTx} cy={tdTy} r={4} fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="1.5" />
          <circle cx={TC} cy={TC} r={3} fill="var(--accent)" />
        </svg>
        <div className="font-mono text-[9px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
          θ = {labelTheta}°
        </div>
      </div>

      {/* Recent commands list */}
      <div className="absolute bottom-4 left-4 z-10" style={{ pointerEvents: "none" }}>
        <div className="text-[9px] tracking-[0.1em] uppercase font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Recent
        </div>
        <div className="space-y-1.5">
          {history.slice(0, 5).map((cmd, i) => (
            <div
              key={cmd.command_id}
              className="font-mono text-[9px] flex gap-1.5"
              style={{ color: i === 0 ? "var(--accent)" : "var(--text-secondary)", opacity: i === 0 ? 1 : 0.5 }}
            >
              <span>θ{cmd.target_theta}</span>
              <span>R{Number(cmd.target_R).toFixed(0)}</span>
              <span>H{Number(cmd.target_H).toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
