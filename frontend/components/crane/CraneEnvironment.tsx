"use client";

import { Grid } from "@react-three/drei";

export function CraneEnvironment() {
  return (
    <>
      {/* Ambient fill light */}
      <ambientLight intensity={0.35} color="#94c8e8" />

      {/* Key light — upper right front */}
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.4}
        color="#e8f4ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Soft fill from opposite side */}
      <directionalLight position={[-8, 8, -8]} intensity={0.3} color="#00d4ff" />

      {/* Ground grid */}
      <Grid
        position={[0, 0, 0]}
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1e2d45"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#00d4ff22"
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Subtle fog for depth */}
      <fog attach="fog" args={["#0a0e17", 30, 80]} />
    </>
  );
}
