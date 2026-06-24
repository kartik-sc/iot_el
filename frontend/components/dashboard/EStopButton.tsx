"use client";

import { useState } from "react";

interface EStopButtonProps {
  onEStop: () => Promise<void>;
}

export function EStopButton({ onEStop }: EStopButtonProps) {
  const [pressed, setPressed] = useState(false);

  async function handleClick() {
    if (pressed) return;
    setPressed(true);
    try {
      await onEStop();
    } finally {
      setTimeout(() => setPressed(false), 3000);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pressed}
      className={`
        w-full py-3 px-4 rounded-lg font-bold text-sm tracking-widest uppercase
        border-2 transition-all duration-200 font-sans
        ${pressed
          ? "bg-red-900/40 border-red-500 text-red-400 cursor-not-allowed"
          : "bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/40 hover:text-red-300 hover:shadow-[0_0_20px_rgba(255,68,68,0.4)] active:scale-95"
        }
      `}
      aria-label="Emergency stop"
    >
      {pressed ? "■ E-STOP SENT" : "■ E-STOP"}
    </button>
  );
}
