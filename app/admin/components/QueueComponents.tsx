// File: app/admin/components/QueueComponents.tsx

import Link from "next/link";
import { Search, UsersRound, Headset, CheckCircle2, PhoneCall, Clock3, RefreshCw, Pencil, Ban, RotateCcw, Building2 } from "lucide-react";
import { cancelVisit, completeVisit, reopenVisit } from "../../actions/admin";
import { formatTime, formatDate, durationSeconds, formatDurationClock, formatCompactDuration, visitorCode } from "../utils";
import { VisitorAvatar, StatusBadge } from "./SharedUI";

export function QueueView({
  activeVisitor, activeVisitorIndex, averageWaitSeconds, connectionOk, filteredVisitors, onEdit, onNextPage, onPreviousPage, onPreview, onQueryChange, onSelectVisitor, onStatusFilterChange, page, pageSize, query, queueCapacity, queueOccupancy, queueOccupancyPercent, selectedVisitorId, statusFilter, totalPages,
}: any) {
  const queueStatusOptions = [
    { value: "ALL" as const, label: "Semua" },
    { value: "ON_PROGRESS" as const, label: "Dilayani" },
    { value: "PENDING" as const, label: "Menunggu" },
  ];
  const showingFrom = filteredVisitors.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(page * pageSize, filteredVisitors.length);

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <QueueActiveSessionCard visitor={activeVisitor} visitorIndex={activeVisitorIndex} onPreview={onPreview} />
        <QueueStatsCard averageWaitSeconds={averageWaitSeconds} connectionOk={connectionOk} queueCapacity={queueCapacity} queueOccupancy={queueOccupancy} queueOccupancyPercent={queueOccupancyPercent} />
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[#f0dfdb] bg-white shadow-[0_18px_48px_rgba(70,31,25,0.07)]">
        <div className="flex flex-col gap-4 border-b border-[#f4e7e3] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="text-xl font-semibold tracking-tight text-[#3b302d]">Daftar Antrean</h3></div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative block md:w-[320px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b8580]" />
              <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Cari kostumer..." className="h-11 w-full rounded-xl border border-[#fae1dc] bg-[#fff3f1] pl-10 pr-3 text-sm font-semibold text-[#3b302d] outline-none transition focus:border-[#d23a2f] focus:bg-white" />
            </label>
            <div className="grid h-11 grid-cols-3 rounded-xl bg-[#fff3f1] p-1 text-xs font-black text-[#7a625d] md:w-[290px]">
              {queueStatusOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => onStatusFilterChange(opt.value)} className={`rounded-lg transition ${statusFilter === opt.value ? "bg-white text-[#b3261e] shadow-sm" : "hover:bg-white/70 hover:text-[#b3261e]"}`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#f4e7e3] bg-[#fffaf9] text-[11px] font-black uppercase tracking-[0.16em] text-[#9b8580]">
              <tr>
                <th className="px-6 py-4 text-center">Tamu</th>
                <th className="px-6 py-4 text-center">Instansi</th>
                <th className="px-6 py-4 text-center">Kategori</th>
                <th className="px-6 py-4 text-center">Waktu Kedatangan</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f8eeeb]">
              {filteredVisitors.slice((page - 1) * pageSize, page * pageSize).map((visitor: any, index: number) => {
                const globalIndex = (page - 1) * pageSize + index;
                return (
                  <tr key={visitor.id} onClick={() => onSelectVisitor(visitor.id)} className={`cursor-pointer transition hover:bg-[#fff7f5] ${selectedVisitorId === visitor.id ? "bg-[#fff2ef]" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <VisitorAvatar visitor={visitor} size="sm" onPreview={onPreview} />
                        <div className="min-w-0">
                          <div className="truncate font-black text-[#3b302d]">{visitor.fullName}</div>
                          <div className="mt-0.5 text-xs font-bold text-[#9b8580]">{visitorCode(visitor, globalIndex)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#7a625d] text-center">{visitor.institution || "Umum"}</td>
                    <td className="px-6 py-4 text-center"><QueueCategoryLabel category={visitor.category} /></td>
                    <td className="px-6 py-4 font-bold text-[#7a625d] text-center">{formatTime(visitor.checkInTime)}</td>
                    <td className="px-6 py-4 text-center"><QueueStatusBadge status={visitor.status} /></td>
                    <td className="px-6 py-4"><QueueRowActions visitor={visitor} onEdit={onEdit} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredVisitors.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#f0dfdb] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#806762]">Menampilkan {showingFrom}-{showingTo} dari {filteredVisitors.length} data</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onPreviousPage} disabled={page === 1} className="h-9 rounded-lg border border-[#f0dfdb] px-3 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:opacity-40">Sebelumnya</button>
              <span className="min-w-16 text-center text-sm font-bold text-[#6f5752]">{page} / {totalPages}</span>
              <button type="button" onClick={onNextPage} disabled={page === totalPages} className="h-9 rounded-lg border border-[#f0dfdb] px-3 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function QueueActiveSessionCard({ visitor, visitorIndex, onPreview }: any) {
  if (!visitor) {
    return (
      <section className="rounded-2xl border border-[#f0dfdb] bg-white p-7 shadow-[0_18px_48px_rgba(70,31,25,0.07)]">
        <div className="inline-flex rounded-lg bg-[#fff0ed] px-3 py-1 text-xs font-black uppercase text-[#b3261e]">Sesi Aktif</div>
        <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#f0dfdb] bg-[#fffaf9] text-center">
          <Headset className="h-10 w-10 text-[#bba5a0]" />
          <p className="mt-3 text-lg font-black text-[#3b302d]">Tidak ada sesi aktif</p>
        </div>
      </section>
    );
  }
  const servingSeconds = durationSeconds(visitor.serviceStartTime || visitor.checkInTime);
  const canComplete = visitor.status === "ON_PROGRESS";

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_18px_48px_rgba(70,31,25,0.07)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-lg bg-[#fff0ed] px-3 py-1 text-xs font-black uppercase text-[#b3261e]">Sesi Aktif</span>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#332926]">Antrean {visitorCode(visitor, visitorIndex)}</h3>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-[#8b7671]">Durasi Layanan</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#b3261e]">{formatDurationClock(servingSeconds)}</p>
        </div>
      </div>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
        <VisitorAvatar visitor={visitor} size="lg" onPreview={onPreview} />
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black text-[#3b302d]">{visitor.fullName}</h4>
          <p className="mt-1 text-sm font-bold text-[#7a625d]">{visitor.institution || "Instansi belum diisi"}</p>
        </div>
      </div>
      <div className="my-6 h-px bg-[#f5e8e4]" />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <form action={completeVisit}>
          <input type="hidden" name="id" value={visitor.id} />
          <button type="submit" disabled={!canComplete} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b3261e] text-sm font-black text-white shadow-md transition hover:bg-[#cf3429] disabled:bg-[#d8c2bd]">
            <CheckCircle2 className="h-5 w-5" /> Tandai selesai
          </button>
        </form>
        <Link href="/admin/live" className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-[#d9b8b2] bg-white text-[#7a625d] transition hover:border-[#b3261e] hover:bg-[#fff3f1] hover:text-[#b3261e]"><PhoneCall className="h-5 w-5" /></Link>
      </div>
    </section>
  );
}

export function QueueStatsCard({ averageWaitSeconds, connectionOk, queueCapacity, queueOccupancy, queueOccupancyPercent }: any) {
  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_18px_48px_rgba(70,31,25,0.07)] sm:p-7">
      <h3 className="text-lg font-black text-[#3b302d]">Ringkasan Cepat</h3>
      <div className="mt-5 space-y-3">
        <div className="rounded-xl bg-[#fff0ed] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#7a625d]">Waktu Tunggu</p>
              <p className="mt-1 text-2xl font-black text-[#3f6fb5]">{formatCompactDuration(averageWaitSeconds)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[#fff7f4] p-4">
          <p className="text-xs font-black text-[#7a625d]">Kapasitas Antrean</p>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-2xl font-black text-[#3b302d]">{queueOccupancy}/{queueCapacity}</p>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e5bcb5]">
              <div className="h-full rounded-full bg-[#b3261e]" style={{ width: `${queueOccupancyPercent}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function QueueCategoryLabel({ category }: any) {
  return <span className="inline-flex items-center gap-2 text-xs font-black text-[#3f6fb5]"><span className="h-1.5 w-1.5 rounded-full bg-[#3f6fb5]" />{category || "Umum"}</span>;
}

export function QueueStatusBadge({ status }: any) {
  if (status === "ON_PROGRESS") return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8edff] px-3 py-1 text-xs font-black text-[#5865d9]"><RefreshCw className="h-3 w-3" /> Dilayani</span>;
  if (status === "PENDING") return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff3d9] px-3 py-1 text-xs font-black text-[#c88717]"><Clock3 className="h-3 w-3" /> Menunggu</span>;
  return <StatusBadge status={status} />;
}

export function QueueRowActions({ visitor, onEdit }: any) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(visitor); }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b3261e] transition hover:bg-[#fff0ed]"><Pencil className="h-4 w-4" /></button>
      {["PENDING", "ON_PROGRESS"].includes(visitor.status) && (
        <form action={cancelVisit}>
          <input type="hidden" name="id" value={visitor.id} />
          <button type="submit" onClick={(e) => e.stopPropagation()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b3261e] transition hover:bg-[#fff0ed] hover:text-[#7a625e]"><Ban className="h-4 w-4" /></button>
        </form>
      )}
    </div>
  );
}