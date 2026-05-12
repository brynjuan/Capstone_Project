import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getAdminSession();

  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.24),transparent_34%),linear-gradient(135deg,#080808_0%,#111827_48%,#1f0606_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-30" />
      </div>
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_440px]">
        <div className="max-w-2xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-600 shadow-[0_0_28px_rgba(220,38,38,0.45)]">
              <Image src="/logo-telkom2.png" alt="Telkom" width={38} height={38} className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-red-300">Admin Dashboard</p>
              <h1 className="text-3xl font-bold tracking-tight">Sistem Buku Tamu Digital</h1>
            </div>
          </div>
          <h2 className="text-5xl font-bold tracking-tight">Masuk untuk memantau kunjungan tamu.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Akses ini khusus resepsionis dan admin untuk melihat data pengunjung,
            pratinjau foto, serta mencatat waktu tamu keluar.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
              <p className="font-bold text-white">Data real-time</p>
              <p className="mt-1">Pantau antrean dan riwayat check-in.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
              <p className="font-bold text-white">Foto tamu</p>
              <p className="mt-1">Lihat bukti visual dari Cloudflare R2.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl">
              <p className="font-bold text-white">Status keluar</p>
              <p className="mt-1">Catat checkout dengan satu aksi.</p>
            </div>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
