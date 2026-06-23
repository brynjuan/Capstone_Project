// File: app/admin/components/SuperadminPanel.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, ShieldAlert, Trash2, User, Key, Mail } from "lucide-react";
import { getAdminListAction, createAdminAction, deleteAdminAction } from "../../actions/superadmin";
import { Role } from "@prisma/client";

export function SuperadminPanel({ showNotification }: { showNotification: (msg: string, type: "success" | "error") => void }) {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState("ADMIN");

  const loadAdmins = async () => {
    try {
      const res = await getAdminListAction();
      if (res.success && res.data) setAdmins(res.data);
    } catch (e) {
      showNotification("Gagal memuat data", "error");
    }
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus akun ini?")) return;
    const res = await deleteAdminAction(id);
    if (res.success) {
      showNotification("Admin berhasil dihapus", "success");
      loadAdmins();
    } else {
      showNotification(res.error || "Gagal menghapus", "error");
    }
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const res = await createAdminAction(formData);
      if (res.success) {
        showNotification("Akun Cabang berhasil dibuat!", "success");
        (document.getElementById("form-add-admin") as HTMLFormElement).reset();
        loadAdmins();
      } else {
        showNotification(res.error || "Gagal membuat akun", "error");
      }
    });
  };

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_350px]">
      {/* KIRI: TABEL DAFTAR ADMIN */}
      <section className="rounded-2xl border border-[#f0dfdb] bg-white shadow-[0_16px_42px_rgba(70,31,25,0.06)] overflow-hidden">
        <div className="p-6 border-b border-[#f0dfdb] bg-[#fffaf9]">
          <h3 className="text-xl font-bold text-[#2b211f]">Daftar Akun Pengelola</h3>
          <p className="mt-1 text-sm text-[#7a625d]">Semua akun Superadmin dan Admin Cabang yang terdaftar di sistem.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#f0dfdb] bg-[#fff3f0] text-xs uppercase tracking-wide text-[#806762]">
              <tr>
                <th className="px-5 py-3 text-left">Nama & Email</th>
                <th className="px-5 py-3 text-center">Akses</th>
                <th className="px-5 py-3 text-center">Wilayah / Cabang</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f7ece9]">
              {admins.map((adm) => (
                <tr key={adm.id} className="hover:bg-[#fff7f5] transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-[#2b211f]">{adm.name}</div>
                    <div className="text-xs text-[#806762]">{adm.email}</div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {adm.role === "SUPERADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700"><ShieldAlert className="w-3 h-3"/> Pusat</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"><User className="w-3 h-3"/> Cabang</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center font-bold text-[#7a625d]">
                    {adm.region || "SEMUA WILAYAH"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDelete(adm.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Akun">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* KANAN: FORM TAMBAH ADMIN BARU */}
      <section className="rounded-2xl border border-[#f0dfdb] bg-white shadow-[0_16px_42px_rgba(70,31,25,0.06)] p-6 h-fit">
        <h3 className="text-xl font-bold text-[#2b211f] mb-4">Buat Akun Baru</h3>
        <form action={handleCreate} id="form-add-admin" className="space-y-4">
          
          <label className="block">
            <span className="text-xs font-bold uppercase text-[#806762] mb-1 block">Nama Lengkap</span>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input name="name" required className="w-full pl-10 pr-4 py-3 bg-[#fff8f6] border border-[#f0dfdb] rounded-xl text-sm focus:border-red-500 outline-none" placeholder="Budi Santoso" />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase text-[#806762] mb-1 block">Email Akun</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" name="email" required className="w-full pl-10 pr-4 py-3 bg-[#fff8f6] border border-[#f0dfdb] rounded-xl text-sm focus:border-red-500 outline-none" placeholder="budi@telkom.co.id" />
            </div>
          </label>

<label className="block">
            <span className="text-xs font-bold uppercase text-[#806762] mb-1 block">Tipe Hak Akses</span>
            <select name="role" required onChange={(e) => setSelectedRole(e.target.value)} className="w-full px-4 py-3 bg-[#fff8f6] border border-[#f0dfdb] rounded-xl text-sm focus:border-red-500 outline-none">
              <option value="ADMIN">Admin Cabang / Daerah</option>
              <option value="KIOSK">Mesin Kiosk (Layar Depan)</option>
              <option value="SUPERADMIN">Superadmin (Kendali Penuh)</option>
            </select>
          </label>

          {/* Kolom ini hanya muncul jika tipenya ADMIN Cabang */}
{/* 👇 UBAH KONDISINYA MENJADI SEPERTI INI 👇 */}
          {selectedRole !== "SUPERADMIN" && (
            <label className="block animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-bold uppercase text-[#806762] mb-1 block">Wilayah / Daerah</span>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input name="region" required className="w-full pl-10 pr-4 py-3 bg-[#fff8f6] border border-[#f0dfdb] rounded-xl text-sm focus:border-red-500 outline-none" placeholder="Contoh: Palu" />
              </div>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-bold uppercase text-[#806762] mb-1 block">Kata Sandi Baru</span>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" name="password" minLength={6} required className="w-full pl-10 pr-4 py-3 bg-[#fff8f6] border border-[#f0dfdb] rounded-xl text-sm focus:border-red-500 outline-none" placeholder="Minimal 6 karakter" />
            </div>
          </label>

          <button type="submit" disabled={isPending} className="w-full mt-4 py-3 bg-[#b3261e] hover:bg-[#cf3429] text-white font-bold rounded-xl transition-all shadow-md disabled:opacity-50">
            {isPending ? "Memproses..." : "Daftarkan Akun"}
          </button>

        </form>
      </section>
    </div>
  );
}