"use client";

import { useState, useCallback } from "react";
import type { CraneCommand } from "@/types/crane";

const MAX_HISTORY = 20;

export function useCommandHistory() {
  const [history, setHistory] = useState<CraneCommand[]>([]);

  const addCommand = useCallback((cmd: CraneCommand) => {
    setHistory(prev => [cmd, ...prev].slice(0, MAX_HISTORY));
  }, []);

  return { history, addCommand };
}
