// File: app/admin/components/SharedUI.tsx

import Link from "next/link";
import Image from "next/image";
import { AdminVisitor } from "../types";
import { visitorInitials } from "../utils";

export function SidebarItem({ icon: Icon, label, active, onClick, href }: any) {
  const className = `flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${active ? "bg-[#cf3429] text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)]" : "text-[#6f5752] hover:bg-[#fff0ed] hover:text-[#b3261e]"}`;
  if (href) return <Link href={href} className={className}><Icon className="h-5 w-5" />{label}</Link>;
  return <button type="button" onClick={onClick} className={className}><Icon className="h-5 w-5" />{label}</button>;
}

export function Metric({ title, value, icon: Icon, tone }: any) {
  const tones = { red: "bg-[#b3261e]/10 text-[#b3261e]", green: "bg-[#62b47d]/12 text-[#4e9b70]", blue: "bg-[#5865d9]/10 text-[#5865d9]", amber: "bg-[#e4a63a]/12 text-[#b07926]", purple: "bg-[#a855f7]/12 text-[#9333ea]" } as any;
  return (
    <section className="rounded-xl border border-[#f0dfdb] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-[#806762]">{title}</p><div className="mt-2 text-3xl font-bold text-[#2b211f]">{value}</div></div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: AdminVisitor["status"] }) {
  if (status === "ON_PROGRESS") return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9dd] bg-[#eefbf4] px-2.5 py-1 text-xs font-bold text-[#4e9b70]"><span className="h-1.5 w-1.5 rounded-full bg-[#62c48a]" /> Dilayani</span>;
  if (status === "PENDING") return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f4ddb5] bg-[#fff8eb] px-2.5 py-1 text-xs font-bold text-[#b07926]"><span className="h-1.5 w-1.5 rounded-full bg-[#f2ae3f]" /> Menunggu</span>;
  if (status === "CANCELLED") return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#efc6c0] bg-[#fff0ed] px-2.5 py-1 text-xs font-bold text-[#b3261e]"><span className="h-1.5 w-1.5 rounded-full bg-[#cf3429]" /> Batal</span>;
  if (status === "PRE_REGISTER") return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e2ff] bg-[#f0f4ff] px-2.5 py-1 text-xs font-bold text-[#3f6fb5]"><span className="h-1.5 w-1.5 rounded-full bg-[#5865d9]" /> Belum Hadir</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9dd] bg-[#eefbf4] px-2.5 py-1 text-xs font-bold text-[#4e9b70]"><span className="h-1.5 w-1.5 rounded-full bg-[#62c48a]" /> Selesai</span>;
}

export function VisitorAvatar({ visitor, size, onPreview }: any) {
  const sizeClass = size === "lg" ? "h-20 w-20 rounded-2xl" : "h-10 w-10 rounded-full";
  const textClass = size === "lg" ? "text-xl" : "text-xs";
  if (visitor.photoUrl) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); onPreview(visitor); }} className={`${sizeClass} shrink-0 overflow-hidden bg-[#fff0ed]`}>
        <Image src={visitor.photoUrl} alt={visitor.fullName} width={size === "lg" ? 80 : 40} height={size === "lg" ? 80 : 40} unoptimized className="h-full w-full object-cover" />
      </button>
    );
  }
  return <div className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center bg-[#fff0ed] font-black text-[#b3261e]`}>{visitorInitials(visitor.fullName)}</div>;
}