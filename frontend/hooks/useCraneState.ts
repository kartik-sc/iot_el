"use client";

import { useEffect, useRef, useState } from "react";
import type { Telemetry } from "@/types/crane";
import { CRANE_LIMITS } from "@/types/crane";

export interface SmoothedCraneState {
  theta: number;
  R: number;
  H: number;
  thetaNorm: number;
  RNorm: number;
  HNorm: number;
}

const LERP_SPEED = 0.08;

export function useCraneState(telemetry: Telemetry): SmoothedCraneState {
  const targetRef = useRef({ theta: 0, R: 0, H: 0 });
  const [smoothed, setSmoothed] = useState({ theta: 0, R: 0, H: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    targetRef.current = {
      theta: telemetry.current_theta ?? 0,
      R: telemetry.current_R ?? 0,
      H: telemetry.current_H ?? 0,
    };
  }, [telemetry]);

  useEffect(() => {
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function tick() {
      setSmoothed(prev => {
        const t = targetRef.current;
        return {
          theta: lerp(prev.theta, t.theta, LERP_SPEED),
          R: lerp(prev.R, t.R, LERP_SPEED),
          H: lerp(prev.H, t.H, LERP_SPEED),
        };
      });
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    theta: smoothed.theta,
    R: smoothed.R,
    H: smoothed.H,
    thetaNorm: smoothed.theta / CRANE_LIMITS.theta.max,
    RNorm: smoothed.R / CRANE_LIMITS.R.max,
    HNorm: smoothed.H / CRANE_LIMITS.H.max,
  };
}
