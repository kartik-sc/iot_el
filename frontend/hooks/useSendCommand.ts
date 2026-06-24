"use client";

import { useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { api } from "@/lib/api";
import type { CraneCommand } from "@/types/crane";

type Status = "idle" | "sending" | "success" | "error";

function newCmdId() {
  return "cmd_" + Math.random().toString(36).slice(2, 7);
}

export function useSendCommand(
  craneId: string | null,
  namespace = "",
  onSuccess?: (cmd: CraneCommand) => void,
) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastCmd, setLastCmd] = useState<CraneCommand | null>(null);

  async function sendCommand(theta: number, R: number, H: number) {
    setStatus("sending");
    const cmd: CraneCommand = {
      command_id: newCmdId(),
      target_theta: theta,
      target_R: R,
      target_H: H,
      timestamp: new Date().toISOString(),
    };

    // Update local state immediately — animation tracks operator intent, not network state.
    setLastCmd(cmd);
    onSuccess?.(cmd);

    // Fire-and-forget network writes in the background.
    const path = namespace ? `/${namespace}/commands/latest` : "/commands/latest";
    set(ref(db, path), cmd)
      .then(() => {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 2000);
      })
      .catch(() => {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      });

    if (craneId) {
      api.commands.send(craneId, theta, R, H).catch(console.warn);
    }
  }

  async function sendEStop() {
    const path = namespace ? `/${namespace}/commands/estop` : "/commands/estop";
    await set(ref(db, path), {
      emergency: true,
      timestamp: new Date().toISOString(),
    });
  }

  return { sendCommand, sendEStop, status, lastCmd };
}
