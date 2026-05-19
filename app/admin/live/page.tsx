import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Headset,
  LayoutDashboard,
  LucideIcon,
  Table2,
} from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { logoutAdmin } from "@/app/actions/auth";
import LiveHelpRoom from "./LiveHelpRoom";

export const dynamic = "force-dynamic";

export default async function AdminLivePage() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf7f5] text-[#2b211f]">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#fffdfb_0%,#fbf4f1_52%,#fde9e4_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(179,38,30,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(179,38,30,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />
      </div>

      <div className="min-h-screen">
        <aside className="flex flex-col border-b border-[#f0dfdb] bg-[#fffaf8]/95 px-5 py-5 shadow-[10px_0_34px_rgba(70,31,25,0.06)] backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-center">
            <Image src="/logo-telkom2.png" alt="Telkom" width={46} height={46} className="h-16 w-19 object-contain" />
          </div>

          <nav className="mt-8 grid gap-2">
            <SidebarLink icon={LayoutDashboard} label="Dashboard" href="/admin" />
            <SidebarLink icon={Table2} label="Antrean" href="/admin" />
            <SidebarLink icon={CheckCircle2} label="Riwayat" href="/admin" />
            <SidebarLink icon={Headset} label="Bantuan Langsung" href="/admin/live" active />
          </nav>

          <div className="mt-auto">
            <form action={logoutAdmin} className="mt-4">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#f0d8d4] bg-white text-sm font-bold text-[#6f5752] transition hover:bg-[#fff7f5] hover:text-[#b3261e]"
              >
                Keluar
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:ml-[280px] lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#f0dfdb] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xl font-semibold tracking-tight text-[#b3261e]">Bantuan Langsung</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#725b56]">
                Pantau dan jawab panggilan langsung dari kiosk dengan cepat dan ramah.
              </p>
            </div>

            <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#cfe9dd] bg-[#eefbf4] px-4 text-sm font-bold text-[#4e9b70] shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[#62c48a]" />
              Siap Menerima Panggilan
            </div>
          </header>

          <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff0ed] text-[#b3261e]">
                <Headset className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold">Panel Bantuan Langsung</h3>
              <p className="mt-2 text-sm leading-6 text-[#725b56]">
                Biarkan halaman ini tetap terbuka saat admin berjaga. Ketika pengunjung menekan tombol bantuan di kiosk,
                panggilan akan masuk ke ruang yang sama.
              </p>
              <div className="mt-6 rounded-xl border border-[#f0dfdb] bg-[#fff8f6] p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Operator Aktif</p>
                <p className="mt-2 font-bold text-[#2b211f]">{admin.name}</p>
                <p className="mt-1 break-all text-[#806762]">{admin.email}</p>
              </div>
            </aside>

            <section className="min-h-[560px] overflow-hidden rounded-2xl border border-[#f0dfdb] bg-black shadow-[0_16px_42px_rgba(70,31,25,0.06)]">
              <LiveHelpRoom adminName={admin.name} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  href,
  active,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
}) {
  const className = `flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
    active
      ? "bg-[#cf3429] text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)]"
      : "text-[#6f5752] hover:bg-[#fff0ed] hover:text-[#b3261e]"
  }`;

  return (
    <Link href={href} className={className}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
