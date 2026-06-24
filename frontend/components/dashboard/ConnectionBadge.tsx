"use client";

interface ConnectionBadgeProps {
  connected: boolean;
}

export function ConnectionBadge({ connected }: ConnectionBadgeProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest">
      <span className="relative flex h-2.5 w-2.5">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? "bg-emerald-400" : "bg-slate-600"}`} />
      </span>
      <span className={connected ? "text-emerald-400" : "text-slate-500"}>
        {connected ? "LIVE" : "OFFLINE"}
      </span>
    </div>
  );
}
