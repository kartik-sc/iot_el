"use client";

import { useEffect, useRef, useState } from "react";
import type { Telemetry, CraneCommand } from "@/types/crane";
import { CRANE_LIMITS } from "@/types/crane";
import type { SmoothedCraneState } from "./useCraneState";

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/**
 * Single rAF LERP loop that feeds both the 2D SVG panel and the 3D R3F canvas.
 *
 * Priority:
 *  1. Live Firebase telemetry (when connected and hardware is reporting)
 *  2. Latest dispatched command (optimistic — works offline)
 *  3. Zero (initial state)
 */
export function useSharedCranePos(
  telemetry: Telemetry,
  connected: boolean,
  latestCommand: CraneCommand | null,
): SmoothedCraneState {
  const targetRef = useRef({ theta: 0, R: 0, H: 0 });
  const [smoothed, setSmoothed] = useState({ theta: 0, R: 0, H: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const hasLive =
      connected &&
      (telemetry.current_theta !== null ||
        telemetry.current_R !== null ||
        telemetry.current_H !== null);

    if (hasLive) {
      targetRef.current = {
        theta: telemetry.current_theta ?? targetRef.current.theta,
        R: telemetry.current_R ?? targetRef.current.R,
        H: telemetry.current_H ?? targetRef.current.H,
      };
    } else if (latestCommand) {
      targetRef.current = {
        theta: latestCommand.target_theta,
        R: latestCommand.target_R,
        H: latestCommand.target_H,
      };
    }
  }, [telemetry, connected, latestCommand]);

  useEffect(() => {
    function tick() {
      setSmoothed(prev => ({
        theta: lerp(prev.theta, targetRef.current.theta, 0.08),
        R: lerp(prev.R, targetRef.current.R, 0.08),
        H: lerp(prev.H, targetRef.current.H, 0.08),
      }));
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
