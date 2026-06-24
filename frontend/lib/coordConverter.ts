import { CRANE_LIMITS, VALID_THETA_ANGLES } from "@/types/crane";

export type Cylindrical = { theta: number; R: number; H: number };
export type Cartesian   = { x: number; y: number; z: number };

const VALID_ANGLES: readonly number[] = VALID_THETA_ANGLES;

export function snapToNearest(raw: number): number {
  return [...VALID_ANGLES].reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
  );
}

export function cylindricalToCartesian(c: Cylindrical): Cartesian {
  const rad = (c.theta * Math.PI) / 180;
  return { x: c.R * Math.cos(rad), y: c.R * Math.sin(rad), z: c.H };
}

export function cartesianToCylindrical(c: Cartesian): {
  cyl: Cylindrical;
  thetaRaw: number;
  snapped: boolean;
} {
  const R        = Math.sqrt(c.x * c.x + c.y * c.y);
  const thetaRaw = (Math.atan2(c.y, c.x) * 180) / Math.PI;
  const theta    = snapToNearest(thetaRaw);
  return { cyl: { theta, R, H: c.z }, thetaRaw, snapped: Math.abs(theta - thetaRaw) > 0.01 };
}

export function isWithinLimits(c: Cylindrical): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!VALID_ANGLES.includes(c.theta))
    errors.push(`θ must be one of ${VALID_ANGLES.join(", ")}°`);
  if (c.R < CRANE_LIMITS.R.min || c.R > CRANE_LIMITS.R.max)
    errors.push(`R must be ${CRANE_LIMITS.R.min}–${CRANE_LIMITS.R.max} cm`);
  if (c.H < CRANE_LIMITS.H.min || c.H > CRANE_LIMITS.H.max)
    errors.push(`H must be ${CRANE_LIMITS.H.min}–${CRANE_LIMITS.H.max} cm`);
  return { valid: errors.length === 0, errors };
}

export function formatCylindrical(c: Cylindrical): string {
  return `θ ${c.theta}°  R ${c.R.toFixed(2)} cm  H ${c.H.toFixed(2)} cm`;
}

export function formatCartesian(c: Cartesian): string {
  return `x ${c.x.toFixed(2)} cm  y ${c.y.toFixed(2)} cm  z ${c.z.toFixed(2)} cm`;
}
