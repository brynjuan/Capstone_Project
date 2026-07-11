// File: app/admin/components/Modals.tsx

import Image from "next/image";
import { X, UserRound, Clock3, Star } from "lucide-react";
import { AdminVisitor } from "../types";
import { elapsedLabel } from "../utils";
import { StatusBadge } from "./SharedUI";

export function VisitorDetail({ selectedVisitor, onPreview, onEdit, isHistory }: any) {
  return (
    <section className="w-full rounded-3xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div><h3 className="text-xl font-bold text-[#2b211f]">{isHistory ? "Detail Kostumer" : "Sesi Aktif"}</h3></div>
      </div>
      {selectedVisitor ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[112px_1fr]">
            <div className="flex items-center justify-center rounded-3xl bg-[#f7f3f1] p-4">
              {selectedVisitor.photoUrl ? (
                <button type="button" onClick={() => onPreview(selectedVisitor)} className="block overflow-hidden rounded-3xl"><Image src={selectedVisitor.photoUrl} alt="Foto" width={112} height={112} unoptimized className="h-28 w-28 object-cover" /></button>
              ) : <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-[#bba5a0]"><UserRound className="h-12 w-12" /></div>}
            </div>
            <div className="space-y-3">
              <div><p className="text-sm font-semibold text-[#7a625d]">{selectedVisitor.institution || "Tanpa instansi"}</p><h4 className="text-2xl font-bold text-[#2b211f]">{selectedVisitor.fullName}</h4></div>
              <StatusBadge status={selectedVisitor.status} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile icon={Clock3} label="Durasi" value={elapsedLabel(selectedVisitor.serviceStartTime || selectedVisitor.checkInTime)} />
            <InfoTile icon={Star} label="Penilaian" value={selectedVisitor.rating ? `${selectedVisitor.rating}/5` : "-"} />
          </div>
<div className="rounded-3xl border border-[#ece0dc] bg-[#fcf8f6] p-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Kategori" value={selectedVisitor.category || "Umum"} />
              <DetailRow label="Petugas" value={selectedVisitor.hostName || "-"} />
              <DetailRow label="Telepon" value={selectedVisitor.phoneNumber || "-"} />
              <DetailRow label="Nomor Internet" value={selectedVisitor.internetNumber || "-"} />
              
              {/* 👇 TAMBAHKAN BLOK ALAMAT DI SINI 👇 */}
              <div className="sm:col-span-2 mt-1 pt-3 border-t border-[#ece0dc]">
                <DetailRow label="Alamat" value={selectedVisitor.address || "-"} />
              </div>
              {/* 👆 AKHIR BLOK ALAMAT 👆 */}
              
            </div>
          </div>
          <div><p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#7a625d]">Keperluan</p><p className="rounded-3xl border border-[#ece0dc] bg-[#faf6f4] p-4 text-sm text-[#3c302d]">{selectedVisitor.purpose || "-"}</p></div>
        </div>
      ) : <p className="text-center text-sm text-[#7a625d]">Pilih salah satu tamu untuk melihat detail.</p>}
    </section>
  );
}

export function EditVisitorDialog({ visitor, isSaving, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b211f]/70 p-4 backdrop-blur-md">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#f0dfdb] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#f0dfdb] px-5 py-4">
          <div><h2 className="text-lg font-bold text-[#2b211f]">Edit Informasi Pelanggan</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#f0dfdb] text-[#806762]"><X className="h-5 w-5" /></button>
        </div>
        <form className="flex max-h-[calc(92vh-73px)] flex-col" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
          <div className="overflow-y-auto p-5">
            <input type="hidden" name="id" value={visitor.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <EditField label="Nama Kostumer" name="fullName" defaultValue={visitor.fullName} required />
              <EditField label="Nomor Telepon" name="phoneNumber" defaultValue={visitor.phoneNumber || ""} />
              <EditField label="Pelanggan / Instansi" name="institution" defaultValue={visitor.institution || ""} />
              <EditField label="Nomor Internet" name="internetNumber" defaultValue={visitor.internetNumber || ""} />
              <EditField label="Kategori" name="category" defaultValue={visitor.category || ""} />
              <EditField label="Petugas Dituju" name="hostName" defaultValue={visitor.hostName || ""} />
            </div>
            <div className="mt-4 grid gap-4">
              <EditTextarea label="Alamat" name="address" defaultValue={visitor.address || ""} rows={3} />
              <EditTextarea label="Keperluan" name="purpose" defaultValue={visitor.purpose} rows={4} required />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-[#f0dfdb] bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-xl border border-[#f0dfdb] px-5 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0]">Batal</button>
            <button type="submit" disabled={isSaving} className="h-11 rounded-xl bg-[#b3261e] px-5 text-sm font-bold text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)] transition hover:bg-[#cf3429]">{isSaving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EditField({ label, name, defaultValue, required }: any) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</span>
      <input name={name} defaultValue={defaultValue} required={required} className="h-11 rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 text-sm font-semibold text-[#2b211f] outline-none transition focus:border-[#d23a2f] focus:bg-white" />
    </label>
  );
}

export function EditTextarea({ label, name, defaultValue, rows, required }: any) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={rows} required={required} className="resize-none rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 py-3 text-sm font-semibold text-[#2b211f] outline-none transition focus:border-[#d23a2f] focus:bg-white" />
    </label>
  );
}

export function InfoTile({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl border border-[#f0dfdb] bg-[#fff8f6] p-3">
      <Icon className="mb-2 h-4 w-4 text-[#b3261e]" />
      <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</p>
      <p className="mt-1 break-words font-bold text-[#3c302d]">{value}</p>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</p>
      <p className="mt-1 text-[#6f5752]">{value}</p>
    </div>
  );
}