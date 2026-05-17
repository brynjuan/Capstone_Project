"use client";

import { User } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle: string;
  profileName?: string;
}

export default function TopBar({ title, subtitle, profileName }: TopBarProps) {
  return (
    <div className="mb-6 rounded-3xl border border-[#f0dfdb] bg-white/95 px-5 py-4 shadow-[0_10px_30px_rgba(70,31,25,0.08)] backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#b3261e]">
            Topupbar
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#2b211f]">{title}</h1>
          <p className="mt-1 text-sm text-[#6f5752]">{subtitle}</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-2xl border border-[#e9e2df] bg-[#f9f5f2] px-4 py-3 text-left shadow-sm transition hover:bg-[#fffaf8]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#b3261e] shadow-sm border border-[#f0e8e4]">
            <User className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-[#2b211f]">{profileName ?? "Profil"}</span>
            <span className="block text-xs text-[#7a625d]">Akun</span>
          </span>
        </button>
      </div>
    </div>
  );
}
