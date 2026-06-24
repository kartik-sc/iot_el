const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  cranes: {
    list: () => apiFetch<import("@/types/crane").Crane[]>("/cranes"),
    create: (name: string, firebase_namespace = "") =>
      apiFetch<import("@/types/crane").Crane>("/cranes", {
        method: "POST",
        body: JSON.stringify({ name, firebase_namespace }),
      }),
  },
  commands: {
    send: (crane_id: string, target_theta: number, target_R: number, target_H: number) =>
      apiFetch<import("@/types/crane").CommandOut>("/commands", {
        method: "POST",
        body: JSON.stringify({ crane_id, target_theta, target_R, target_H }),
      }),
    list: (crane_id: string, limit = 50, offset = 0) =>
      apiFetch<{ items: import("@/types/crane").CommandOut[]; total: number }>(
        `/commands?crane_id=${crane_id}&limit=${limit}&offset=${offset}`
      ),
  },
  telemetry: {
    history: (crane_id: string, from: string, to: string) =>
      apiFetch<import("@/types/crane").TelemetrySnapshot[]>(
        `/telemetry/history?crane_id=${crane_id}&from=${from}&to=${to}`
      ),
    latest: (crane_id: string) =>
      apiFetch<import("@/types/crane").TelemetrySnapshot | null>(
        `/telemetry/latest?crane_id=${crane_id}`
      ),
  },
  faults: {
    list: (crane_id: string, resolved?: boolean) => {
      const params = new URLSearchParams({ crane_id });
      if (resolved !== undefined) params.set("resolved", String(resolved));
      return apiFetch<import("@/types/crane").FaultEvent[]>(`/faults?${params}`);
    },
  },
};
