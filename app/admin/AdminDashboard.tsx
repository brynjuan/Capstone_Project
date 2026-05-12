"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Headset,
  LayoutDashboard,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Table2,
  UserRound,
  UsersRound,
  WifiOff,
  X,
} from "lucide-react";
import { completeVisit, reopenVisit } from "../actions/admin";
import { logoutAdmin } from "../actions/auth";

const ZegoCall = dynamic(() => import("../components/ZegoCall"), { ssr: false });

export type AdminVisitor = {
  id: string;
  createdAt: string | null;
  fullName: string;
  phoneNumber: string | null;
  institution: string | null;
  internetNumber: string | null;
  address: string | null;
  category: string | null;
  purpose: string;
  hostName: string | null;
  photoUrl: string | null;
  status: "PENDING" | "ON_PROGRESS" | "VISITING" | "COMPLETED";
  checkInTime: string | null;
  checkOutTime: string | null;
  rating: number | null;
};

export type AdminDashboardData = {
  connectionOk: boolean;
  visitors: AdminVisitor[];
  metrics: {
    totalToday: number;
    totalMonth: number;
    totalYear: number;
    pendingVisits: number;
    onProgressVisits: number;
    successVisits: number;
    completedToday: number;
    averageRating: number | null;
  };
  categories: Array<{
    name: string;
    count: number;
  }>;
  dailySeries: Array<{ label: string; value: number }>;
  monthlySeries: Array<{ label: string; value: number }>;
  yearlySeries: Array<{ label: string; value: number }>;
  categoryMonthlySeries: Array<{
    name: string;
    data: Array<{ label: string; value: number }>;
  }>;
};

type Props = {
  data: AdminDashboardData;
  admin: {
    id: string;
    email: string;
    name: string;
  };
};

const formatTime = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
};

const formatDate = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
};

const elapsedLabel = (value: string | null) => {
  if (!value) return "-";

  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes < 60) return `${minutes} menit`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}j ${rest}m`;
};

export default function AdminDashboard({ data, admin }: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"dashboard" | "queue" | "history">("dashboard");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminVisitor["status"]>("ALL");
  const [selectedVisitorId, setSelectedVisitorId] = useState(data.visitors[0]?.id ?? "");
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [page, setPage] = useState(1);
  const [previewPhoto, setPreviewPhoto] = useState<AdminVisitor | null>(null);
  const pageSize = 10;

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [router]);

  const queueVisitors = useMemo(
    () =>
      data.visitors
        .filter((visitor) => ["PENDING", "ON_PROGRESS", "VISITING"].includes(visitor.status))
        .sort((a, b) => {
          const priority = (status: AdminVisitor["status"]) =>
            status === "ON_PROGRESS" || status === "VISITING" ? 0 : 1;
          const priorityDiff = priority(a.status) - priority(b.status);

          if (priorityDiff !== 0) return priorityDiff;

          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }),
    [data.visitors],
  );
  const historyVisitors = useMemo(
    () =>
      data.visitors
        .filter((visitor) => visitor.status === "COMPLETED")
        .sort((a, b) => new Date(b.checkOutTime || 0).getTime() - new Date(a.checkOutTime || 0).getTime()),
    [data.visitors],
  );
  const tableSource = activeView === "history" ? historyVisitors : queueVisitors;

  const filteredVisitors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tableSource.filter((visitor) => {
      const matchesStatus = statusFilter === "ALL" || visitor.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          visitor.fullName,
          visitor.institution,
          visitor.phoneNumber,
          visitor.internetNumber,
          visitor.category,
          visitor.hostName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, tableSource]);

  const selectedVisitor =
    tableSource.find((visitor) => visitor.id === selectedVisitorId) ?? filteredVisitors[0] ?? null;
  const maxCategoryCount = Math.max(1, ...data.categories.map((item) => item.count));
  const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / pageSize));
  const visibleVisitors = filteredVisitors.slice((page - 1) * pageSize, page * pageSize);
  const viewCopy = {
    dashboard: {
      eyebrow: "Dashboard Resepsionis",
      title: "Statistik Kunjungan",
      description: "Ringkasan pengunjung harian, bulanan, tahunan, dan kategori permasalahan terbanyak.",
    },
    queue: {
      eyebrow: "Manajemen Antrian",
      title: "Antrian Pengunjung",
      description: "Pengunjung pertama diproses sebagai On Progress, antrean berikutnya menunggu sebagai Pending.",
    },
    history: {
      eyebrow: "Riwayat Layanan",
      title: "History Pengunjung",
      description: "Daftar pengunjung yang sudah diselesaikan permasalahannya oleh admin.",
    },
  }[activeView];

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#fee2e2_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />
      </div>

      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white/85 px-5 py-5 shadow-sm backdrop-blur-2xl lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 shadow-[0_0_28px_rgba(220,38,38,0.45)]">
              <Image src="/logo-telkom2.png" alt="Telkom" width={34} height={34} className="object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-600">Telkom</p>
              <h1 className="text-lg font-bold leading-tight">Admin Kiosk</h1>
            </div>
          </div>

          <nav className="mt-8 grid gap-2">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeView === "dashboard"}
              onClick={() => setActiveView("dashboard")}
            />
            <SidebarItem
              icon={Table2}
              label="Antrian"
              active={activeView === "queue"}
              onClick={() => {
                setActiveView("queue");
                setStatusFilter("ALL");
                setPage(1);
              }}
            />
            <SidebarItem
              icon={CheckCircle2}
              label="History"
              active={activeView === "history"}
              onClick={() => {
                setActiveView("history");
                setStatusFilter("ALL");
                setPage(1);
              }}
            />
            <SidebarItem icon={Headset} label="Bantuan Live" onClick={() => setShowCallPanel((current) => !current)} />
          </nav>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{admin.name}</p>
                <p className="truncate text-xs text-slate-500">{admin.email}</p>
              </div>
            </div>
            <form action={logoutAdmin} className="mt-4">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-red-600">{viewCopy.eyebrow}</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{viewCopy.title}</h2>
              <p className="mt-2 text-sm text-slate-600">
                {viewCopy.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm ${
                  data.connectionOk
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    data.connectionOk ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {data.connectionOk ? "Database Aktif" : "Database Offline"}
              </div>
              <a
                href="/admin"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-50 hover:text-red-700"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </a>
              <button
                type="button"
                onClick={() => setShowCallPanel((current) => !current)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] transition hover:bg-red-500"
              >
                <Headset className="h-4 w-4" />
                Bantuan Live
              </button>
            </div>
          </header>

          {!data.connectionOk && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              <WifiOff className="h-5 w-5" />
              Database belum dapat diakses. Pastikan `DATABASE_URL` sudah benar dan PostgreSQL aktif.
            </div>
          )}

          {activeView === "dashboard" && (
            <>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <Metric title="Pending" value={data.metrics.pendingVisits} icon={Clock3} tone="amber" />
                <Metric title="On Progress" value={data.metrics.onProgressVisits} icon={Headset} tone="blue" />
                <Metric title="Success" value={data.metrics.successVisits} icon={CheckCircle2} tone="green" />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <SeriesPanel title="Statistik Pengunjung Perhari" data={data.dailySeries} />
                <SeriesPanel title="Statistik Pengunjung Perbulan" data={data.monthlySeries} />
                <SeriesPanel title="Statistik Pengunjung Pertahun" data={data.yearlySeries} />
                <ProblemPanel series={data.categoryMonthlySeries} />
              </div>
            </>
          )}

  

          {activeView !== "dashboard" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm backdrop-blur-2xl">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="text-xl font-bold">
                    {activeView === "history" ? "Daftar History" : "List Antrian"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeView === "history"
                      ? "Pengunjung yang sudah berstatus success."
                      : "On Progress selalu berada di layanan aktif, Pending menunggu giliran."}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Cari nama, instansi, nomor..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-400 sm:w-72"
                    />
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as typeof statusFilter);
                      setPage(1);
                    }}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-red-400"
                  >
                    <option value="ALL">Semua Status</option>
                    {activeView === "history" ? (
                      <option value="COMPLETED">Success</option>
                    ) : (
                      <>
                        <option value="ON_PROGRESS">On Progress</option>
                        <option value="PENDING">Pending</option>
                        <option value="VISITING">Legacy Visiting</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Tamu</th>
                      <th className="px-5 py-3">Kategori</th>
                      <th className="px-5 py-3">Petugas</th>
                      <th className="px-5 py-3">{activeView === "history" ? "Waktu Layanan" : "Check-in"}</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleVisitors.map((visitor) => (
                      <tr
                        key={visitor.id}
                        onClick={() => setSelectedVisitorId(visitor.id)}
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selectedVisitor?.id === visitor.id ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-950">{visitor.fullName}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <Building2 className="h-3.5 w-3.5" />
                            {visitor.institution || "Instansi belum diisi"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {visitor.category || "Umum"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{visitor.hostName || "-"}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-950">
                            {activeView === "history"
                              ? `${formatTime(visitor.checkInTime)} - ${formatTime(visitor.checkOutTime)}`
                              : formatTime(visitor.checkInTime)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {activeView === "history" ? formatDate(visitor.checkOutTime) : formatDate(visitor.checkInTime)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={visitor.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {visitor.status === "PENDING" ? (
                            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                              Menunggu
                            </span>
                          ) : (
                            <form
                              action={
                                ["ON_PROGRESS", "VISITING"].includes(visitor.status)
                                  ? completeVisit
                                  : reopenVisit
                              }
                            >
                              <input type="hidden" name="id" value={visitor.id} />
                              <button
                                type="submit"
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-600 hover:text-white"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {["ON_PROGRESS", "VISITING"].includes(visitor.status)
                                  ? "Selesai Success"
                                  : "Buka Lagi"}
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredVisitors.length === 0 && (
                <div className="px-5 py-14 text-center">
                  <UsersRound className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-3 font-bold text-slate-700">Belum ada data sesuai filter.</p>
                  <p className="text-sm text-slate-500">Coba ubah pencarian atau status kunjungan.</p>
                </div>
              )}

              {filteredVisitors.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Menampilkan {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, filteredVisitors.length)} dari {filteredVisitors.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <span className="min-w-16 text-center text-sm font-bold text-slate-700">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <VisitorDetail selectedVisitor={selectedVisitor} onPreview={setPreviewPhoto} />
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-2xl">
                <h3 className="text-lg font-bold">Kategori Teratas</h3>
                <div className="mt-5 space-y-4">
                  {data.categories.length > 0 ? (
                    data.categories.map((item) => (
                      <div key={item.name}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-600">{item.name}</span>
                          <span className="font-bold text-slate-950">{item.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.6)]"
                            style={{ width: `${(item.count / maxCategoryCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Kategori akan muncul setelah data kunjungan tersedia.</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
          )}
        </section>
      </div>

      {previewPhoto?.photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-md">
          <section className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Pratinjau Foto Pengunjung</h2>
                <p className="text-sm text-slate-500">{previewPhoto.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                aria-label="Tutup pratinjau foto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-50 p-5">
              <div className="relative mx-auto aspect-video max-h-[70vh] overflow-hidden rounded-xl bg-slate-100">
                <Image
                  src={previewPhoto.photoUrl}
                  alt={previewPhoto.fullName}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function SeriesPanel({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <BarChart3 className="h-5 w-5 text-red-600" />
      </div>
      <div className="mt-6 flex h-52 items-end gap-3">
        {data.length > 0 ? (
          data.map((item) => (
            <div key={`${title}-${item.label}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end rounded-xl bg-slate-100 p-1">
                <div
                  className="w-full rounded-lg bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.55)]"
                  style={{ height: `${Math.max(8, (item.value / maxValue) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-500">{item.label}</span>
              <span className="text-sm font-bold text-slate-950">{item.value}</span>
            </div>
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
            Belum ada data statistik.
          </div>
        )}
      </div>
    </section>
  );
}

function ProblemPanel({
  series,
}: {
  series: AdminDashboardData["categoryMonthlySeries"];
}) {
  const chartWidth = 640;
  const chartHeight = 220;
  const padding = 28;
  const colors = ["#dc2626", "#2563eb", "#059669", "#d97706", "#7c3aed"];
  const labels = series[0]?.data.map((item) => item.label) ?? [];
  const maxValue = Math.max(1, ...series.flatMap((item) => item.data.map((point) => point.value)));
  const xStep = labels.length > 1 ? (chartWidth - padding * 2) / (labels.length - 1) : 0;
  const yFor = (value: number) =>
    chartHeight - padding - (value / maxValue) * (chartHeight - padding * 2);
  const xFor = (index: number) => padding + xStep * index;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Permasalahan Paling Sering</h3>
          <p className="mt-1 text-sm text-slate-500">Tren kategori kunjungan dalam 6 bulan terakhir.</p>
        </div>
        <Activity className="h-5 w-5 text-red-600" />
      </div>
      <div className="mt-6">
        {series.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full" role="img">
                {[0, 1, 2, 3].map((line) => {
                  const y = padding + ((chartHeight - padding * 2) / 3) * line;

                  return (
                    <line
                      key={`grid-${line}`}
                      x1={padding}
                      x2={chartWidth - padding}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                  );
                })}

                {series.map((item, itemIndex) => {
                  const points = item.data
                    .map((point, index) => `${xFor(index)},${yFor(point.value)}`)
                    .join(" ");

                  return (
                    <g key={item.name}>
                      <polyline
                        points={points}
                        fill="none"
                        stroke={colors[itemIndex % colors.length]}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {item.data.map((point, index) => (
                        <circle
                          key={`${item.name}-${point.label}`}
                          cx={xFor(index)}
                          cy={yFor(point.value)}
                          r="4"
                          fill={colors[itemIndex % colors.length]}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      ))}
                    </g>
                  );
                })}

                {labels.map((label, index) => (
                  <text
                    key={label}
                    x={xFor(index)}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[12px] font-bold"
                  >
                    {label}
                  </text>
                ))}
              </svg>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {series.map((item, index) => (
                <div key={item.name} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  {item.name}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
            Tren kategori akan muncul setelah data kunjungan tersedia.
          </div>
        )}
      </div>
    </section>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
        active
          ? "bg-red-600 text-white shadow-[0_0_24px_rgba(220,38,38,0.25)]"
          : "text-slate-600 hover:bg-red-50 hover:text-red-700"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: typeof UsersRound;
  tone: "red" | "green" | "blue" | "amber";
}) {
  const tones = {
    red: "bg-red-500 text-red-600",
    green: "bg-emerald-500 text-emerald-600",
    blue: "bg-sky-500 text-sky-600",
    amber: "bg-amber-500 text-amber-600",
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-opacity-10 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: AdminVisitor["status"] }) {
  if (status === "ON_PROGRESS" || status === "VISITING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        On Progress
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Success
    </span>
  );
}

function VisitorDetail({
  selectedVisitor,
  onPreview,
}: {
  selectedVisitor: AdminVisitor | null;
  onPreview: (visitor: AdminVisitor) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm backdrop-blur-2xl">
      <h3 className="text-lg font-bold">Detail Tamu</h3>
      {selectedVisitor ? (
        <div className="mt-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {selectedVisitor.photoUrl ? (
                <button
                  type="button"
                  onClick={() => onPreview(selectedVisitor)}
                  className="h-full w-full"
                  aria-label={`Lihat foto ${selectedVisitor.fullName}`}
                >
                  <Image
                    src={selectedVisitor.photoUrl}
                    alt={selectedVisitor.fullName}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <UserRound className="h-8 w-8 text-slate-400" />
              )}
            </div>
            <div>
              <h4 className="text-xl font-bold leading-tight text-slate-950">{selectedVisitor.fullName}</h4>
              <p className="mt-1 text-sm text-slate-500">{selectedVisitor.institution || "Tanpa instansi"}</p>
              <div className="mt-3">
                <StatusBadge status={selectedVisitor.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoTile icon={Clock3} label="Durasi" value={elapsedLabel(selectedVisitor.checkInTime)} />
            <InfoTile icon={Star} label="Rating" value={selectedVisitor.rating ? `${selectedVisitor.rating}/5` : "-"} />
            <InfoTile icon={Phone} label="Telepon" value={selectedVisitor.phoneNumber || "-"} />
            <InfoTile icon={Activity} label="No. Internet" value={selectedVisitor.internetNumber || "-"} />
          </div>

          <div className="space-y-4 border-t border-slate-200 pt-5 text-sm">
            <DetailRow label="Kategori" value={selectedVisitor.category || "Umum"} />
            <DetailRow label="Petugas Dituju" value={selectedVisitor.hostName || "-"} />
            <DetailRow label="Keperluan" value={selectedVisitor.purpose || "-"} />
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 text-red-600" />
              <span>{selectedVisitor.address || "Alamat belum diisi"}</span>
            </div>
          </div>

          {selectedVisitor.photoUrl && (
            <button
              type="button"
              onClick={() => onPreview(selectedVisitor)}
              className="h-11 w-full rounded-xl bg-red-600 text-sm font-bold text-white shadow-[0_0_24px_rgba(220,38,38,0.25)] transition hover:bg-red-500"
            >
              Lihat Pratinjau Foto
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Pilih salah satu tamu untuk melihat detail.</p>
      )}
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Icon className="mb-2 h-4 w-4 text-red-600" />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-800">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-slate-700">{value}</p>
    </div>
  );
}
