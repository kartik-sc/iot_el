"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { MotorStatus } from "@/types/crane";
import { CRANE_LIMITS } from "@/types/crane";

// ── Visual dimensions (world units) ──────────────────
const MAST_HEIGHT = 8;
const BOOM_LENGTH = 16;   // represents CRANE_LIMITS.R.max cm
const HOOK_MAX_DROP = 6;  // represents CRANE_LIMITS.H.max cm

interface CraneModelProps {
  theta: number;       // degrees
  R: number;           // cm (trolley radial distance)
  H: number;           // cm (hook height)
  motorStatus: MotorStatus;
}

function craneColor(motorStatus: MotorStatus): string {
  if (motorStatus === "ERROR" || motorStatus === "TIMEOUT") return "#ff4444";
  if (motorStatus === "MOVING") return "#ffb800";
  return "#00d4ff";
}

function usePulse(motorStatus: MotorStatus) {
  const ref = useRef(1);
  useFrame(({ clock }) => {
    if (motorStatus === "ERROR" || motorStatus === "TIMEOUT") {
      ref.current = 0.5 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 4));
    } else if (motorStatus === "MOVING") {
      ref.current = 0.7 + 0.3 * Math.abs(Math.sin(clock.elapsedTime * 2));
    } else {
      ref.current = 1;
    }
  });
  return ref;
}

export function CraneModel({ theta, R, H, motorStatus }: CraneModelProps) {
  const color = craneColor(motorStatus);
  const pulseRef = usePulse(motorStatus);

  const thetaRad = (theta * Math.PI) / 180;
  const trolleyX = (R / CRANE_LIMITS.R.max) * BOOM_LENGTH;
  const hookDrop = (H / CRANE_LIMITS.H.max) * HOOK_MAX_DROP + 0.5;

  // Rope endpoints: from trolley down
  const ropeTop: [number, number, number] = [0, 0, 0];
  const ropeBot: [number, number, number] = [0, -hookDrop, 0];

  // Safe zone corners (full θ sweep, at max x, from y=0 to y=max)
  // Rendered as a translucent cylinder shell
  const safeZoneRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* ── Base plate ── */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[3, 0.2, 3]} />
        <meshStandardMaterial color="#1a2236" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* ── Mast (vertical, static) ── */}
      <mesh position={[0, MAST_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.35, MAST_HEIGHT, 0.35]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── Apex sphere ── */}
      <mesh position={[0, MAST_HEIGHT + 0.3, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>

      {/* ── Counter-jib (backward, static) ── */}
      <mesh position={[-1.5, MAST_HEIGHT - 0.1, 0]} castShadow>
        <boxGeometry args={[3, 0.22, 0.28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.08} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Counter-jib back cable */}
      <Line
        points={[[0, MAST_HEIGHT + 0.3, 0], [-2.8, MAST_HEIGHT - 0.1, 0]]}
        color={color}
        lineWidth={1}
        opacity={0.5}
        transparent
      />

      {/* ── Boom group — rotates on Y by theta ── */}
      <group rotation={[0, -thetaRad, 0]}>
        {/* Support cable from apex to boom tip */}
        <Line
          points={[[0, MAST_HEIGHT + 0.3, 0], [BOOM_LENGTH, MAST_HEIGHT - 0.1, 0]]}
          color={color}
          lineWidth={1}
          opacity={0.5}
          transparent
        />

        {/* Boom arm */}
        <mesh position={[BOOM_LENGTH / 2, MAST_HEIGHT - 0.1, 0]} castShadow>
          <boxGeometry args={[BOOM_LENGTH, 0.22, 0.28]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} metalness={0.6} roughness={0.3} />
        </mesh>

        {/* ── Trolley — slides along boom ── */}
        <group position={[trolleyX, MAST_HEIGHT - 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.35, 0.5]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Trolley wheels hint */}
          {[-0.18, 0.18].map((zOff, i) => (
            <mesh key={i} position={[0, -0.22, zOff]}>
              <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
              <meshStandardMaterial color="#6b8ca8" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}

          {/* ── Rope from trolley to hook ── */}
          <Line
            points={[ropeTop, ropeBot]}
            color="#6b8ca8"
            lineWidth={1.5}
          />

          {/* Hook */}
          <group position={[0, -hookDrop, 0]}>
            <mesh>
              <torusGeometry args={[0.12, 0.035, 8, 16, Math.PI * 1.3]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.07, 0.2, 0.07]} />
              <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── Safe-zone cylinder (translucent, shows reach envelope) ── */}
      <mesh ref={safeZoneRef} position={[0, MAST_HEIGHT / 2, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[BOOM_LENGTH, BOOM_LENGTH, MAST_HEIGHT, 48, 1, true]} />
        <meshStandardMaterial
          color="#00d4ff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
          wireframe={false}
        />
      </mesh>
    </group>
  );
}
