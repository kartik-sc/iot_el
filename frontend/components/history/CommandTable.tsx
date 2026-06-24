"use client";

import type { CommandOut } from "@/types/crane";

interface CommandTableProps {
  commands: CommandOut[];
  loading: boolean;
}

export function CommandTable({ commands, loading }: CommandTableProps) {
  if (loading) {
    return <div className="text-slate-500 text-sm py-8 text-center font-mono">Loading command history…</div>;
  }
  if (commands.length === 0) {
    return <div className="text-slate-600 text-sm py-8 text-center font-mono">No commands recorded yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-[#1e2d45] text-left">
            {["Command ID", "θ (°)", "R (cm)", "H (cm)", "User", "Sent at"].map((h) => (
              <th key={h} className="pb-2 pr-6 text-[10px] tracking-widest uppercase text-slate-500 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {commands.map((cmd) => (
            <tr key={cmd.id} className="border-b border-[#1e2d45]/50 hover:bg-[#1a2236]/50 transition-colors">
              <td className="py-2.5 pr-6 text-cyan-400">{cmd.command_id}</td>
              <td className="py-2.5 pr-6 text-slate-200">{cmd.target_theta}</td>
              <td className="py-2.5 pr-6 text-slate-200">{cmd.target_R}</td>
              <td className="py-2.5 pr-6 text-slate-200">{cmd.target_H}</td>
              <td className="py-2.5 pr-6 text-slate-500">{cmd.user_id ?? "—"}</td>
              <td className="py-2.5 text-slate-400">{new Date(cmd.sent_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
