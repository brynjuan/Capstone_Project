"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Ban,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardList, // Pastikan ini ada jika dipakai di menu
  Clock3,
  Eye,
  Headset,
  Key,
  LayoutDashboard,
  MapPin,
  MoreVertical,
  Pencil,
  PhoneCall,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Table2,
  UserRound,
  UsersRound,
  WifiOff,
  X,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { cancelVisit, completeVisit, reopenVisit, updateVisitorInfo, generateVisitorPin, clearAllPreRegisterVisitsAction, deleteVisitor } from "../actions/admin";
import { logoutAdmin } from "../actions/auth";
import { supabase } from "@/lib/supabase"; 

// Import Tipe Data & Utils
import { AdminVisitor, AdminDashboardData } from "./types";
import { 
  formatTime, 
  formatDate, 
  elapsedLabel, 
  durationSeconds, 
  formatDurationClock, 
  formatCompactDuration, 
  visitorInitials, 
  visitorCode 
} from "./utils";

// Import Komponen UI yang sudah dipecah
import { SidebarItem, Metric, StatusBadge, VisitorAvatar } from "./components/SharedUI";
import { VisitorDetail, EditVisitorDialog, EditField, EditTextarea } from "./components/Modals"; // Tambahkan EditField & EditTextarea jika dipakai di form PIN
import { TrafficPanel, ProblemPanel } from "./components/Charts";
import { 
  QueueView, 
  QueueActiveSessionCard, 
  QueueStatsCard, 
  QueueCategoryLabel, 
  QueueStatusBadge, 
  QueueRowActions 
} from "./components/QueueComponents";

import { SuperadminPanel } from "./components/SuperadminPanel";

// Konstanta Kategori untuk Form Buat PIN
const KATEGORI_KUNJUNGAN = [
  "Lapor Gangguan",
  "Permintaan Pasang Baru (PSB)",
  "Permintaan Pindah Alamat",
  "Permintaan Modify (Upgrade & Downgrade)",
  "Permintaan Cabut (DO)",
  "Invoicing",
  "TTD SPJ",
  "Benah Tiang / Kabel"
];

type Props = {
  data: AdminDashboardData;
  admin: {
    id: string;
    email: string;
    name: string;
    role: "SUPERADMIN" | "ADMIN" | "KIOSK"; // <--- TAMBAHKAN "KIOSK" DI SINI
    region: string | null;
  };
};

export default function AdminDashboard({ data, admin }: Props) {
  const router = useRouter();
const [activeView, setActiveView] = useState<"dashboard" | "queue" | "history" | "pin" | "status" | "preregister" | "superadmin">("dashboard");
  const [trafficRange, setTrafficRange] = useState<"daily" | "monthly" | "yearly">("daily");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminVisitor["status"]>("ALL");
  const [selectedVisitorId, setSelectedVisitorId] = useState(data.visitors[0]?.id ?? "");
  const [page, setPage] = useState(1);
  const [previewPhoto, setPreviewPhoto] = useState<AdminVisitor | null>(null);
  const [editingVisitor, setEditingVisitor] = useState<AdminVisitor | null>(null);
  const [detailVisitor, setDetailVisitor] = useState<AdminVisitor | null>(null);
  const [isSavingVisitor, startSavingVisitor] = useTransition();
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [isGeneratingPin, startGeneratingPin] = useTransition();
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: "success" | "error" } | null>(null);
  const [historyRange, setHistoryRange] = useState<"today" | "month" | "year" | "all">("today");

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(null), 3000); 
  };
  const pageSize = 10;

  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNotification = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.error("Gagal memutar audio:", e);
        showNotification("Gagal memutar suara. Pastikan file audio valid dan tidak diblokir browser.", "error");
      });
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('visitor-queue-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitor_logs' },
        (payload) => { 
          // Kita sudah memindahkan trigger notifikasi ke state queueVisitors 
          // agar lebih stabil dan mencakup tamu scan PIN (UPDATE).
          router.refresh(); 
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Terkoneksi ke Supabase Realtime');
        }
      });

    const fallbackTimer = window.setInterval(() => {
      router.refresh();
    }, 12000);

    return () => {
      window.clearInterval(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const queueVisitors = useMemo(
    () =>
      data.visitors
        .filter((visitor) => ["PENDING", "ON_PROGRESS"].includes(visitor.status))
        .sort((a, b) => {
          const priority = (status: AdminVisitor["status"]) =>
            status === "ON_PROGRESS" ? 0 : 1;
          const priorityDiff = priority(a.status) - priority(b.status);

          if (priorityDiff !== 0) return priorityDiff;

          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }),
    [data.visitors],
  );

  const [prevQueueCount, setPrevQueueCount] = useState<number | null>(null);

  useEffect(() => {
    if (prevQueueCount === null) {
      setPrevQueueCount(queueVisitors.length);
      return;
    }

    if (queueVisitors.length > prevQueueCount) {
      playNotification();
    }
    setPrevQueueCount(queueVisitors.length);
  }, [queueVisitors.length, prevQueueCount]);

  const preRegisterVisitors = useMemo(() => {
    return data.visitors
      .filter((visitor) => visitor.status === "PRE_REGISTER")
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [data.visitors]);

  const totalPreRegister = preRegisterVisitors.length;

  const handleClearAllPreRegister = async () => {
    const isConfirmed = window.confirm(
      "Apakah Anda yakin ingin MENGHAPUS SEMUA PIN tamu yang belum datang (Pre-Register)? Tindakan ini akan menghanguskan PIN mereka."
    );

    if (isConfirmed) {
      const result = await clearAllPreRegisterVisitsAction();
      if (result.success) {
        showNotification(`Berhasil menghapus ${result.count} PIN tamu fiktif/batal.`, "success");
      } else {
        showNotification("Gagal menghapus data: " + result.error, "error");
      }
    }
  };

  const historyVisitors = useMemo(() => {
    const now = new Date();
    return data.visitors
      .filter((visitor) => {
        if (!["SUCCESS", "CANCELLED"].includes(visitor.status)) return false;
        if (historyRange === "all") return true;

        const compareDate = visitor.checkOutTime ? new Date(visitor.checkOutTime) : new Date(visitor.checkInTime || 0);

        if (historyRange === "today") {
          return compareDate.toDateString() === now.toDateString();
        }
        if (historyRange === "month") {
          return compareDate.getMonth() === now.getMonth() && compareDate.getFullYear() === now.getFullYear();
        }
        if (historyRange === "year") {
          return compareDate.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .sort((a, b) => new Date(b.checkOutTime || 0).getTime() - new Date(a.checkOutTime || 0).getTime());
  }, [data.visitors, historyRange]); 

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

  const selectedVisitor = tableSource.find((visitor) => visitor.id === selectedVisitorId) ?? filteredVisitors[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / pageSize));
  const visibleVisitors = filteredVisitors.slice((page - 1) * pageSize, page * pageSize);
  const activeQueueVisitor = queueVisitors.find((visitor) => visitor.status === "ON_PROGRESS") ?? queueVisitors[0] ?? null;
  const activeQueueIndex = activeQueueVisitor
    ? Math.max(0, queueVisitors.findIndex((visitor) => visitor.id === activeQueueVisitor.id))
    : 0;
  const queueCapacity = 40;
  const queueOccupancy = Math.min(queueVisitors.length, queueCapacity);
  const queueOccupancyPercent = Math.min(100, Math.round((queueOccupancy / queueCapacity) * 100));

  const activeVisitorWaitSeconds = activeQueueVisitor && activeQueueVisitor.serviceStartTime
    ? Math.max(0, durationSeconds(activeQueueVisitor.checkInTime, activeQueueVisitor.serviceStartTime))
    : 0;

  const historyMetrics = useMemo(() => {
    const successOnly = historyVisitors.filter(v => v.status === "SUCCESS");
    
    const rated = successOnly.filter(v => v.rating && v.rating > 0);
    const avgRating = rated.length > 0 
      ? (rated.reduce((acc, v) => acc + (v.rating || 0), 0) / rated.length).toFixed(1) 
      : null;

    const waitSum = successOnly.reduce((acc, v) => {
      const waitTime = durationSeconds(v.checkInTime, v.serviceStartTime || v.checkOutTime);
      return acc + Math.max(0, waitTime);
    }, 0);
    
    const avgWait = successOnly.length > 0 ? Math.round(waitSum / successOnly.length) : 0;

    return { successCount: successOnly.length, avgRating, avgWait };
  }, [historyVisitors]);

  const viewCopy = {
    dashboard: {
      eyebrow: "Dashboard Resepsionis",
      title: "Ringkasan Dashboard", 
      description: "Pantau antrean, sesi layanan, dan statistik penggunaan kiosk dalam satu tampilan.",
    },
    queue: {
      eyebrow: "Manajemen Antrean",
      title: "Antrean Kostumer", 
      description: "Kostumer pertama diproses sebagai sedang dilayani, sedangkan antrean berikutnya menunggu giliran.",
    },
    history: {
      eyebrow: "Riwayat Layanan",
      title: "Riwayat Kunjungan", 
      description: "Daftar kostumer yang layanannya sudah diselesaikan oleh admin.",
    },
    pin: {
      eyebrow: "Akses & Keamanan",
      title: "Buat Token / PIN",
      description: "Manajemen pembuatan token atau PIN akses untuk aplikasi.",
    },
    status: {
      eyebrow: "Kontrol Operasional",
      title: "Status Layanan CS",
      description: "Ubah status menjadi Sibuk/Istirahat dan berikan alasan spesifik untuk mengunci layar.",
    },
    preregister: {
      eyebrow: "Daftar Tunggu",
      title: "Pre-Register & PIN",
      description: "Tamu yang mendaftar via web/mobile dan belum melakukan check-in di Kiosk."
    },
    // 👇 TAMBAHKAN BLOK SUPERADMIN INI 👇
    superadmin: {
      eyebrow: "Manajemen Akses",
      title: "Superadmin Panel",
      description: "Kelola akun pengelola dan admin untuk masing-masing cabang daerah."
    }
    // 👆 SAMPAI SINI 👆
  }[activeView];

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf7f5] text-[#2b211f]">
      <audio ref={audioRef} src="/notifikasi_admin.mp3" preload="auto" />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#fffdfb_0%,#fbf4f1_52%,#fde9e4_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(179,38,30,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(179,38,30,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />
      </div>

      <div className="min-h-screen">
        <aside className="flex flex-col border-b border-[#f0dfdb] bg-[#fffaf8]/95 px-5 py-5 shadow-[10px_0_34px_rgba(70,31,25,0.06)] backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-center">
            <Image src="/logo-telkom2.png" alt="Telkom" width={46} height={46} className="h-16 w-18" />
          </div>

          <nav className="mt-8 grid gap-2">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeView === "dashboard"}
              onClick={() => setActiveView("dashboard")}
            />
            <SidebarItem
              icon={SlidersHorizontal}
              label="Status CS"
              active={activeView === "status"}
              onClick={() => setActiveView("status")}
            />
            <SidebarItem
              icon={Table2}
              label="Antrean"
              active={activeView === "queue"}
              onClick={() => {
                setActiveView("queue");
                setStatusFilter("ALL");
                setPage(1);
              }}
            />
            {/* Menu Daftar Tunggu (Pre-Register) */}
            <SidebarItem 
              icon={ClipboardList} 
              label={`Daftar Tunggu (${totalPreRegister})`} 
              active={activeView === "preregister"} 
              onClick={() => setActiveView("preregister")} 
            />
            <SidebarItem
              icon={Key}
              label="Buat Pin"
              active={activeView === "pin"}
              onClick={() => {
                setActiveView("pin");
              }}
            />
            <SidebarItem
              icon={CheckCircle2}
              label="Riwayat"
              active={activeView === "history"}
              onClick={() => {
                setActiveView("history");
                setStatusFilter("ALL");
                setPage(1);
              }}
            />
            <SidebarItem icon={Headset} label="Bantuan Langsung" href="/admin/live" />
          </nav>

          {admin.role === "SUPERADMIN" && (
              <SidebarItem
                icon={ShieldAlert}
                label="Akses Superadmin"
                active={activeView === "superadmin"}
                onClick={() => setActiveView("superadmin")}
              />
            )}

          <div className="mt-auto">
            <form action={logoutAdmin} className="mt-4">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#f0d8d4] bg-white text-sm font-bold text-[#6f5752] transition hover:bg-[#fff7f5] hover:text-[#b3261e]"
              >
                Keluar
              </button>
            </form>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:ml-[280px] lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#f0dfdb] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm text-xl font-semibold tracking-tight text-[#b3261e]">{viewCopy?.eyebrow}</p>
              <p className="mt-2 max-w-2xl text-sm text-[#725b56]">
                {viewCopy?.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm ${
                  data.connectionOk
                    ? "border-[#cfe9dd] bg-[#eefbf4] text-[#4e9b70]"
                    : "border-[#f4ddb5] bg-[#fff8eb] text-[#b07926]"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    data.connectionOk ? "bg-[#62c48a]" : "bg-[#f2ae3f]"
                  }`}
                />
                {data.connectionOk ? "Database Aktif" : "Database Tidak Aktif"}
              </div>
              
              {/* Tombol Sapu Bersih PIN yang tidak terpakai */}
              {activeView === "preregister" && totalPreRegister > 0 && (
                <button
                  onClick={handleClearAllPreRegister}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#efc6c0] bg-[#fff0ed] px-4 text-sm font-bold text-[#b3261e] shadow-sm transition-all hover:bg-[#b3261e] hover:text-white"
                  title="Hapus semua tamu yang belum datang"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Bersihkan PIN ({totalPreRegister})
                </button>
              )}

            </div>
          </header>

          {!data.connectionOk && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#f4ddb5] bg-[#fff8eb] px-4 py-3 text-sm font-semibold text-[#b07926]">
              <WifiOff className="h-5 w-5" />
              Basis data belum dapat diakses. Pastikan `DATABASE_URL` sudah benar dan PostgreSQL aktif.
            </div>
          )}

          {activeView === "dashboard" && (
            <>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <Metric title="Menunggu" value={data.metrics.pendingVisits} icon={Clock3} tone="amber" />
                <Metric title="Sedang Dilayani" value={data.metrics.onProgressVisits} icon={Headset} tone="blue" />
                <Metric title="Selesai" value={data.metrics.successVisits} icon={CheckCircle2} tone="green" />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <TrafficPanel
                  activeRange={trafficRange}
                  onRangeChange={setTrafficRange}
                  dailyData={data.dailySeries}
                  monthlyData={data.monthlySeries}
                  yearlyData={data.yearlySeries}
                />
                <ProblemPanel series={data.categoryMonthlySeries} />
              </div>
            </>
          )}
{/* ======================================================== */}
          {/* TAMPILAN MANAJEMEN SUPERADMIN                            */}
          {/* ======================================================== */}
          {activeView === "superadmin" && admin.role === "SUPERADMIN" && (
            <SuperadminPanel showNotification={showNotification} />
          )}
          {activeView === "queue" && (
            <QueueView
              activeVisitor={activeQueueVisitor}
              activeVisitorIndex={activeQueueIndex}
              averageWaitSeconds={activeVisitorWaitSeconds}
              connectionOk={data.connectionOk}
              filteredVisitors={filteredVisitors}
              onEdit={setEditingVisitor}
              onNextPage={() => setPage((current) => Math.min(totalPages, current + 1))}
              onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
              onPreview={setPreviewPhoto}
              onQueryChange={(value: string) => {
                setQuery(value);
                setPage(1);
              }}
              onSelectVisitor={setSelectedVisitorId}
              onStatusFilterChange={(value: string) => {
                setStatusFilter(value as any);
                setPage(1);
              }}
              page={page}
              pageSize={pageSize}
              query={query}
              queueCapacity={queueCapacity}
              queueOccupancy={queueOccupancy}
              queueOccupancyPercent={queueOccupancyPercent}
              selectedVisitorId={selectedVisitor?.id ?? selectedVisitorId}
              statusFilter={statusFilter}
              totalPages={totalPages}
              visibleVisitors={visibleVisitors}
            />
          )}

          {/* ======================================================== */}
          {/* TAMPILAN DAFTAR TUNGGU (PRE-REGISTER)                      */}
          {/* ======================================================== */}
          {activeView === "preregister" && (
            <div className="mt-6">
              <section className="min-w-0 rounded-2xl border border-[#f0dfdb] bg-white p-6 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#2b211f]">Daftar Tunggu / PIN</h3>
                  <p className="mt-1 text-sm text-[#7a625d]">
                    Menampilkan tamu yang mendaftar via Web/Mobile atau dibuatkan PIN oleh Admin, namun belum melakukan check-in di mesin Kiosk.
                  </p>
                </div>

                {preRegisterVisitors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e6d0cc] bg-[#fffaf9] py-16">
                    <div className="rounded-full bg-[#fcedea] p-4"><UsersRound className="h-8 w-8 text-[#b3261e] opacity-50" /></div>
                    <p className="mt-4 text-sm font-semibold text-[#7a625d]">Tidak ada tamu dalam daftar tunggu.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#f0dfdb] shadow-[0_8px_30px_rgba(70,31,25,0.04)]">
                    <table className="min-w-full divide-y divide-[#f0dfdb]">
                      <thead className="bg-[#fffaf9]">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#7a625d]">Nama Tamu</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#7a625d]">Kontak & Instansi</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#7a625d]">Keperluan</th>
                          <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-[#7a625d]">PIN Akses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0dfdb] bg-white">
                        {preRegisterVisitors.map((visitor) => (
                          <tr key={visitor.id} className="hover:bg-[#fffaf9] transition-colors group">
                            <td className="whitespace-nowrap px-6 py-5">
                              <div className="flex items-center gap-3">
                                {visitor.photoUrl ? (
                                  <img src={visitor.photoUrl} alt="Foto" className="h-10 w-10 rounded-full object-cover border border-[#f0dfdb]" />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fcedea] text-[#b3261e] font-bold">
                                    {visitorInitials(visitor.fullName)}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-[#2b211f] text-base">{visitor.fullName}</div>
                                  <div className="text-xs text-[#9b8580] mt-0.5">Didaftarkan: {formatTime(visitor.createdAt)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="text-sm font-bold text-[#2b211f]">{visitor.institution || "-"}</div>
                              <div className="text-sm text-[#7a625d] mt-1 flex items-center gap-1">
                                <PhoneCall className="w-3 h-3"/> {visitor.phoneNumber}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-[#725b56] max-w-[200px] truncate" title={visitor.purpose}>
                              <span className="font-bold text-[#b3261e] block mb-1">{visitor.category || "Umum"}</span>
                              {visitor.purpose}
                            </td>
                            <td className="whitespace-nowrap px-6 py-5 text-center">
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center justify-center rounded-xl bg-[#eefbf4] px-4 py-2 text-xl font-black tracking-[0.2em] text-[#2e7d32] border border-[#cfe9dd]">
                                  {visitor.pin}
                                </span>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(visitor.pin || "");
                                    showNotification("PIN disalin!", "success");
                                  }}
                                  className="text-xs text-[#b3261e] font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                                >
                                  Salin PIN
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeView === "pin" && (
            <div className="mt-6">
              <section className="min-w-0 rounded-2xl border border-[#f0dfdb] bg-white p-6 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#2b211f]">Form Pembuatan Token / PIN</h3>
                  <p className="mt-1 text-sm text-[#7a625d]">
                    Isi data pelanggan untuk menghasilkan PIN. Kostumer dapat memasukkan PIN ini di layar Kiosk untuk mempercepat proses pendaftaran.
                  </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
                  {/* Form Pembuatan PIN */}
                  <form
                    action={(formData) => {
                      startGeneratingPin(async () => {
                        const res = await generateVisitorPin(formData);
                        if (res.success && res.pin) {
                          setGeneratedPin(res.pin);
                          (document.getElementById("form-buat-pin") as HTMLFormElement)?.reset();
                        } else {
                          alert(res.error || "Gagal membuat PIN");
                        }
                      });
                    }}
                    id="form-buat-pin"
                    className="flex flex-col space-y-4"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <EditField label="Nama Kostumer *" name="fullName" defaultValue="" required />
                      <EditField label="Nomor Telepon" name="phoneNumber" defaultValue="" />
                      <EditField label="Instansi / Perusahaan" name="institution" defaultValue="" />
                      <EditField label="Nomor Internet (IndiHome/Astinet)" name="internetNumber" defaultValue="" />
                    </div>
                    
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Kategori Kunjungan *</span>
                      <select name="category" required className="h-11 rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 text-sm font-semibold text-[#2b211f] outline-none transition focus:border-[#d23a2f] focus:bg-white">
                        <option value="">Pilih kategori...</option>
                        {KATEGORI_KUNJUNGAN.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                      </select>
                    </label>

                    <EditTextarea label="Alamat / Keterangan Tambahan" name="address" defaultValue="" rows={3} />

                    <div className="flex pt-2">
                      <button
                        type="submit"
                        disabled={isGeneratingPin}
                        className="inline-flex h-12 items-center justify-center rounded-xl bg-[#b3261e] px-8 text-sm font-bold text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)] transition hover:bg-[#cf3429] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Key className="mr-2 h-4 w-4" />
                        {isGeneratingPin ? "Memproses..." : "Buat PIN Akses"}
                      </button>
                    </div>
                  </form>

                  {/* Area Hasil PIN */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#f0dfdb] bg-[#fffaf9] p-6 text-center">
                    {generatedPin ? (
                      <div className="animate-in fade-in zoom-in w-full duration-300">
                        <p className="text-xs font-black uppercase tracking-widest text-[#62b47d]">PIN BERHASIL DIBUAT</p>
                        <div className="my-4 rounded-xl bg-[#eefbf4] py-4 text-5xl font-black tracking-[0.15em] text-[#2b211f] shadow-inner">
                          {generatedPin}
                        </div>
                        <p className="text-xs font-semibold text-[#8b7671]">
                          Berikan 6 digit angka di atas kepada pelanggan.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedPin);
                            showNotification("PIN berhasil disalin ke clipboard!", "success");
                          }}
                          className="mt-4 text-xs font-bold text-[#b3261e] hover:underline"
                        >
                          Salin PIN
                        </button>
                      </div>
                    ) : (
                      <div className="text-[#bba5a0]">
                        <Key className="mx-auto mb-3 h-10 w-10 opacity-50" />
                        <p className="text-sm font-bold">PIN akan muncul di sini</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeView === "status" && (
            <div className="mt-6">
              <section className="min-w-0 rounded-2xl border border-[#f0dfdb] bg-white p-6 shadow-[0_16px_42px_rgba(70,31,25,0.06)]">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#2b211f]">Pengaturan Status Meja CS</h3>
                  <p className="mt-1 text-sm text-[#7a625d]">
                    Ketikkan alasan spesifik Anda (misal: "Sedang Sholat"). Pelanggan tidak akan bisa mendaftar sampai status dikembalikan ke READY.
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const isBusy = formData.get("isBusy") === "true";
                    const message = formData.get("message") as string;
                    
                    const { updateKioskStatus } = await import("../actions/admin");
                    const res = await updateKioskStatus(isBusy, message);
                    if (res.success) {
                      showNotification("Status Kiosk Berhasil Diperbarui!", "success");
                    } else {
                      showNotification("Gagal mengubah status.", "error");
                    }
                  }}
                  className="space-y-6"
                >
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Status Operasional CS</span>
                    <select
                      name="isBusy"
                      defaultValue={data.kioskStatus?.isBusy ? "true" : "false"}
                      className="h-11 w-full max-w-md rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 text-sm font-semibold text-[#2b211f] outline-none focus:border-[#d23a2f]"
                    >
                      <option value="false">🟢 SIAP</option>
                      <option value="true">🔴 SIBUK</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Pesan Khusus ke Pelanggan</span>
                    <textarea 
                      name="message" 
                      defaultValue={data.kioskStatus?.message || ""} 
                      placeholder="Contoh: Petugas CS sedang istirahat sholat hingga pukul 13:00 WITA."
                      rows={4} 
                      required
                      className="resize-none rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-4 py-3 text-sm font-semibold text-[#2b211f] outline-none transition placeholder:text-[#a8918c] focus:border-[#d23a2f] focus:bg-white shadow-inner"
                    />
                  </label>

                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#b3261e] px-8 text-sm font-bold text-white shadow-md transition hover:bg-[#cf3429]"
                  >
                    Simpan Perubahan
                  </button>
                </form>
              </section>
            </div>
            )}
          
          {activeView === "history" && (
            <>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <Metric 
                  title={historyRange === "today" ? "Selesai Hari Ini" : historyRange === "month" ? "Selesai Bulan Ini" : historyRange === "year" ? "Selesai Tahun Ini" : "Total Selesai"} 
                  value={historyMetrics.successCount} 
                  icon={CheckCircle2} tone="green" 
                />
                <Metric 
                  title="Rating Rata-rata" 
                  value={historyMetrics.avgRating ? `⭐ ${historyMetrics.avgRating} / 5` : "-"} 
                  icon={Star} tone="amber" 
                />
                <Metric 
                  title="Waktu Tunggu Rata-rata" 
                  value={historyMetrics.avgWait ? formatCompactDuration(historyMetrics.avgWait) : "-"} 
                  icon={Clock3} tone="blue" 
                />
              </div>

              <div className="mt-6">
                <section className="min-w-0 rounded-2xl border border-[#f0dfdb] bg-white shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
                  <div className="flex flex-col gap-4 border-b border-[#f3e3df] p-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {activeView === "history" ? "Daftar Riwayat" : "Daftar Antrean"}
                      </h3>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      
                      <select
                        value={historyRange}
                        onChange={(event) => {
                          setHistoryRange(event.target.value as "today" | "month" | "year" | "all");
                          setPage(1); 
                        }}
                        className="h-11 rounded-xl border border-[#f0dfdb] bg-[#fff7f5] px-3 text-sm font-bold text-[#b3261e] outline-none focus:border-[#d23a2f]"
                      >
                        <option value="today">📅 Hari Ini</option>
                        <option value="month">📅 Bulan Ini</option>
                        <option value="year">📅 Tahun Ini</option>
                        <option value="all">📅 Semua Waktu</option>
                      </select>

                      <label className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8918c]" />
                        <input
                          value={query}
                          onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                          }}
                          placeholder="Cari nama, instansi, nomor..."
                          className="h-11 w-full rounded-xl border border-[#f0dfdb] bg-[#fff7f5] pl-9 pr-3 text-sm text-[#2b211f] outline-none placeholder:text-[#a8918c] focus:border-[#d23a2f] sm:w-72"
                        />
                      </label>
                      
                      <select
                        value={statusFilter}
                        onChange={(event) => {
                          setStatusFilter(event.target.value as typeof statusFilter);
                          setPage(1);
                        }}
                        className="h-11 rounded-xl border border-[#f0dfdb] bg-[#fff7f5] px-3 text-sm text-[#2b211f] outline-none focus:border-[#d23a2f]"
                      >
                        <option value="ALL">Status</option>
                        {activeView === "history" ? (
                          <>
                            <option value="SUCCESS">Selesai</option>
                            <option value="CANCELLED">Dibatalkan</option>
                          </>
                        ) : (
                          <>
                            <option value="ON_PROGRESS">Sedang Dilayani</option>
                            <option value="PENDING">Menunggu</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-[#f0dfdb] bg-[#fff3f0] text-xs uppercase tracking-wide text-[#806762]">
                    <tr>
                      <th className="px-5 py-3 text-center">Tamu</th>
                      <th className="px-5 py-3 text-center">Kategori</th>
                      <th className="px-5 py-3 text-center">Petugas</th>
                      <th className="px-5 py-3 text-center">{activeView === "history" ? "Waktu Layanan" : "Waktu Kedatangan"}</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      {activeView === "history" && <th className="px-5 py-3 text-center">Rating</th>}
                      <th className="px-5 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f7ece9]">
                    {visibleVisitors.map((visitor) => (
                      <tr
                        key={visitor.id}
                        onClick={() => setSelectedVisitorId(visitor.id)}
                        className={`cursor-pointer transition hover:bg-[#fff7f5] ${
                          selectedVisitorId === visitor.id ? "bg-[#fff0ed]" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#2b211f]">{visitor.fullName}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[#806762]">
                            <Building2 className="h-3.5 w-3.5" />
                            {visitor.institution || "Instansi belum diisi"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-xs font-bold text-[#56628f]">
                            {visitor.category || "Umum"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#725b56] text-center">{visitor.hostName || "-"}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#2b211f] text-center">
                            {activeView === "history"
                              ? `${formatTime(visitor.serviceStartTime || visitor.checkInTime)} - ${formatTime(visitor.checkOutTime)}`
                              : formatTime(visitor.serviceStartTime || visitor.checkInTime)}
                          </div>
                          <div className="text-xs text-[#806762] text-center">
                            {activeView === "history" ? formatDate(visitor.checkOutTime) : formatDate(visitor.checkInTime)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={visitor.status} />
                        </td>
                        {activeView === "history" && (
                          <td className="px-5 py-4 text-center">
                            {visitor.rating ? (
                              <div className="flex items-center justify-center gap-1">
                                {(() => {
                                  const ratingValue = Math.floor(visitor.rating);
                                  return [...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${
                                        i < ratingValue
                                          ? "fill-[#e4a63a] text-[#e4a63a]"
                                          : i - ratingValue < 1
                                            ? "fill-[#e4a63a] text-[#e4a63a]"
                                            : "text-[#ddd]"
                                      }`}
                                    />
                                  ));
                                })()}
                              </div>
                            ) : (
                              <span className="text-[#806762]">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {activeView === "history" && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedVisitorId(visitor.id);
                                  setDetailVisitor(visitor);
                                }}
                                title="Lihat detail"
                                aria-label="Lihat detail"
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#efc6c0] bg-[#fff0ed] text-[#b3261e] transition hover:bg-[#b3261e] hover:text-white text-xs font-bold px-3"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </button>
                            )}
                            {activeView === "history" && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingVisitor(visitor);
                                }}
                                title="Edit"
                                aria-label="Edit"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#efc6c0] bg-[#fff0ed] text-[#b3261e] transition hover:bg-[#b3261e] hover:text-white"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {visitor.status !== "PENDING" && (
                              <form
                                action={
                                  visitor.status === "ON_PROGRESS"
                                    ? completeVisit
                                    : reopenVisit
                                }
                              >
                                <input type="hidden" name="id" value={visitor.id} />
                                <button
                                  type="submit"
                                  title={visitor.status === "ON_PROGRESS" ? "Tandai selesai" : "Buka kembali"}
                                  aria-label={visitor.status === "ON_PROGRESS" ? "Tandai selesai" : "Buka kembali"}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#efc6c0] bg-[#fff0ed] text-[#b3261e] transition hover:bg-[#b3261e] hover:text-white"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {visitor.status === "ON_PROGRESS" ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4" />
                                  )}
                                </button>
                              </form>
                            )}

                            {["PENDING", "ON_PROGRESS"].includes(visitor.status) && (
                              <form action={cancelVisit}>
                                <input type="hidden" name="id" value={visitor.id} />
                                <button
                                  type="submit"
                                  title="Batalkan"
                                  aria-label="Batalkan"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#f2c7c2] bg-white text-[#b3261e] transition hover:bg-[#fff0ed]"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              </form>
                            )}

                            {["SUCCESS", "CANCELLED"].includes(visitor.status) && activeView === "history" && (
                              <form action={deleteVisitor} onSubmit={(e) => {
                                if (!confirm("Apakah Anda yakin ingin menghapus data ini? Aksi ini akan menghapus data di database, spreadsheet, dan telegram laporan.")) {
                                  e.preventDefault();
                                }
                              }}>
                                <input type="hidden" name="id" value={visitor.id} />
                                <button
                                  type="submit"
                                  title="Hapus Riwayat"
                                  aria-label="Hapus Riwayat"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#efc6c0] bg-[#fff0ed] text-[#b3261e] transition hover:bg-[#b3261e] hover:text-white"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredVisitors.length === 0 && (
                <div className="px-5 py-14 text-center">
                  <UsersRound className="mx-auto h-10 w-10 text-[#bba5a0]" />
                  <p className="mt-3 font-bold text-[#6f5752]">Belum ada data sesuai filter.</p>
                  <p className="text-sm text-[#806762]">Coba ubah pencarian atau status kunjungan.</p>
                </div>
              )}

              {filteredVisitors.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-[#f0dfdb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#806762]">
                    Menampilkan {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, filteredVisitors.length)} dari {filteredVisitors.length} data
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="h-9 rounded-lg border border-[#f0dfdb] px-3 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <span className="min-w-16 text-center text-sm font-bold text-[#6f5752]">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="h-9 rounded-lg border border-[#f0dfdb] px-3 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </section>
              </div>
            </>
          )}
        </section>
      </div>

      {previewPhoto?.photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b211f]/70 p-6 backdrop-blur-md">
          <section className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#f0dfdb] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#f0dfdb] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#2b211f]">Pratinjau Foto Kostumer</h2>
                <p className="text-sm text-[#806762]">{previewPhoto.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#f0dfdb] text-[#806762] transition hover:bg-[#fff3f0] hover:text-[#2b211f]"
                aria-label="Tutup pratinjau foto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-[#fff8f6] p-5">
              <div className="relative mx-auto aspect-video max-h-[70vh] overflow-hidden rounded-xl bg-[#fff3f0]">
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

      {detailVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/30 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDetailVisitor(null)} />
          <div className="relative z-10 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="absolute right-0 top-0 z-20">
              <button
                type="button"
                onClick={() => setDetailVisitor(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#806762] shadow-sm transition hover:bg-[#f3f3f3]"
                aria-label="Tutup detail kostumer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <VisitorDetail
              selectedVisitor={detailVisitor}
              onPreview={setPreviewPhoto}
              onEdit={(visitor: AdminVisitor) => {
                setDetailVisitor(null);
                setEditingVisitor(visitor);
              }}
              isHistory
            />
          </div>
        </div>
      )}
      
      {editingVisitor && (
        <EditVisitorDialog
          visitor={editingVisitor}
          isSaving={isSavingVisitor}
          onClose={() => setEditingVisitor(null)}
          onSubmit={(formData: FormData) => {
            startSavingVisitor(() => {
              void updateVisitorInfo(formData).then(() => {
                setEditingVisitor(null);
                router.refresh();
              });
            });
          }}
        />
      )}

      {/* ===== TOAST NOTIFICATION MODERN ===== */}
      {notification && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-[0_15px_40px_rgba(0,0,0,0.2)] transition-all animate-in slide-in-from-top-8 fade-in duration-300 ${
          notification.type === "success" 
            ? "bg-[#4e9b70] border border-[#3e7c59]" 
            : "bg-[#b3261e] border border-[#921e17]"
        }`}>
          {notification.type === "success" ? (
            <CheckCircle2 className="h-6 w-6 text-[#a7dfc0]" />
          ) : (
            <X className="h-6 w-6 text-[#f3a8a5]" />
          )}
          <span className="text-sm font-bold tracking-wide">{notification.message}</span>
        </div>
      )}
      
    </main>
  );
}