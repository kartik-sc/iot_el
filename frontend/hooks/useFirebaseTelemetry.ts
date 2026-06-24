"use client";

import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Telemetry } from "@/types/crane";

const DEFAULT_TELEMETRY: Telemetry = {
  current_theta: null,
  current_R: null,
  current_H: null,
  motor_status: "IDLE",
  system_status: "OK",
  last_updated: null,
};

export function useFirebaseTelemetry(namespace = "") {
  const [telemetry, setTelemetry] = useState<Telemetry>(DEFAULT_TELEMETRY);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Live connection monitor
    const connRef = ref(db, ".info/connected");
    const unsubConn = onValue(connRef, (snap) => setConnected(!!snap.val()));

    // Telemetry listener
    const path = namespace ? `/${namespace}/telemetry/latest` : "/telemetry/latest";
    const telemRef = ref(db, path);
    const unsubTelem = onValue(telemRef, (snap) => {
      const data = snap.val();
      if (data) setTelemetry(data as Telemetry);
      else setTelemetry(DEFAULT_TELEMETRY);
    });

    return () => {
      off(connRef);
      off(telemRef);
      unsubConn();
      unsubTelem();
    };
  }, [namespace]);

  return { telemetry, connected };
}
