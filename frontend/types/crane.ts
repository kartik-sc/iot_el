export type MotorStatus = "IDLE" | "MOVING" | "ERROR" | "TIMEOUT";
export type SystemStatus = "OK" | "ERR:LIMIT" | "ERR:TIMEOUT" | "ERR:MALFORMED";

export interface Telemetry {
  current_theta: number | null;
  current_R: number | null;
  current_H: number | null;
  motor_status: MotorStatus;
  system_status: SystemStatus;
  last_updated: string | null;
}

export interface CraneCommand {
  command_id: string;
  target_theta: number;
  target_R: number;
  target_H: number;
  timestamp: string;
}

export interface CommandOut {
  id: string;
  command_id: string;
  crane_id: string;
  user_id: string | null;
  target_theta: number;
  target_R: number;
  target_H: number;
  sent_at: string;
}

export interface TelemetrySnapshot {
  id: string;
  crane_id: string;
  current_theta: number | null;
  current_R: number | null;
  current_H: number | null;
  motor_status: string | null;
  system_status: string | null;
  recorded_at: string;
}

export interface FaultEvent {
  id: string;
  crane_id: string;
  motor_status: string | null;
  system_status: string | null;
  occurred_at: string;
  resolved_at: string | null;
}

export interface Crane {
  id: string;
  name: string;
  firebase_namespace: string;
  created_at: string;
}

export const CRANE_LIMITS = {
  theta: { min: 0, max: 90 },
  R:     { min: 0, max: 40 },
  H:     { min: 0, max: 30 },
} as const;

export const VALID_THETA_ANGLES = [0, 30, 60, 90] as const;

export type CylindricalCoord = { theta: number; R: number; H: number };
export type CartesianCoord   = { x: number; y: number; z: number };
