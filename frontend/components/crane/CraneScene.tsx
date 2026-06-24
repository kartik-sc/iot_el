"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { CraneModel } from "./CraneModel";
import { CraneEnvironment } from "./CraneEnvironment";
import type { SmoothedCraneState } from "@/hooks/useCraneState";
import type { MotorStatus } from "@/types/crane";

interface CraneSceneProps {
  craneState: SmoothedCraneState;
  motorStatus: MotorStatus;
}

export function CraneScene({ craneState, motorStatus }: CraneSceneProps) {
  return (
    <div className="w-full h-full min-h-[420px] rounded-lg overflow-hidden bg-[#0a0e17]">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        {/* Fixed diagonal camera */}
        <PerspectiveCamera makeDefault position={[20, 16, 20]} fov={35} near={0.1} far={200} />

        {/* Allow limited orbit — keep diagonal feel but let user inspect */}
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={20}
          maxDistance={50}
          target={[0, 4, 0]}
        />

        <Suspense fallback={null}>
          <CraneEnvironment />
          <CraneModel
            theta={craneState.theta}
            R={craneState.R}
            H={craneState.H}
            motorStatus={motorStatus}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
