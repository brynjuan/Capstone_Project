"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Ban,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
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
} from "lucide-react";
import { cancelVisit, completeVisit, reopenVisit, updateVisitorInfo, generateVisitorPin, clearAllPreRegisterVisitsAction } from "../actions/admin";
import { logoutAdmin } from "../actions/auth";
import { supabase } from "@/lib/supabase"; // Sesuaikan path jika berbeda

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
  status: "PENDING" | "ON_PROGRESS" | "SUCCESS" | "CANCELLED" | "PRE_REGISTER";
  checkInTime: string | null;
  serviceStartTime: string | null;
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
  kioskStatus?: {
    isBusy: boolean;
    message: string;
  };
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

const durationSeconds = (start: string | null, end?: string | null) => {
  if (!start) return 0;

  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();

  return Math.max(0, Math.floor((endTime - startTime) / 1000));
};

const waitSecondsFor = (visitor: AdminVisitor) =>
  durationSeconds(visitor.checkInTime, visitor.serviceStartTime || visitor.checkOutTime);

const formatDurationClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${String(minutes).padStart(2, "0")} : ${String(rest).padStart(2, "0")}`;
};

const formatCompactDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes < 60) return `${minutes}m ${String(rest).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}j ${minutes % 60}m`;
};

const visitorInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "VI";
};

const visitorCode = (visitor: AdminVisitor, index = 0) => {
  const categoryPrefix = (visitor.category || "Q").replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase() || "Q";
  const numericId = visitor.id.replace(/\D/g, "").slice(-3);
  const number = numericId ? numericId.padStart(3, "0") : String(index + 101).padStart(3, "0");

  return `#${categoryPrefix}-${number}`;
};

export default function AdminDashboard({ data, admin }: Props) {
  const router = useRouter();
const [activeView, setActiveView] = useState<"dashboard" | "queue" | "history" | "pin" | "status">("dashboard");
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
  const [historyRange, setHistoryRange] = useState<"today" | "month" | "year" | "all">("today"); // 👈 TAMBAHKAN INI


  // Fungsi pintar untuk memanggil notifikasi yang hilang otomatis dalam 3 detik
  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification(null), 3000); 
  };
  const pageSize = 10;

  const [, setTick] = useState(0);

  useEffect(() => {
    // Membuat timer yang mengubah state tick setiap 1000ms (1 detik)
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    // Membersihkan timer saat komponen ditutup agar tidak bocor (memory leak)
    return () => clearInterval(timer);
  }, []);
  // 👆 SAMPAI SINI 👆

useEffect(() => {
    // Berlangganan ke semua perubahan (INSERT, UPDATE, DELETE) di tabel visitor_logs
    const channel = supabase
      .channel('visitor-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'visitor_logs', // Pastikan nama tabel persis seperti di database
        },
        (payload) => {
          // Setiap kali ada data yang berubah di database, refresh halaman
          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Terkoneksi ke Supabase Realtime');
        }
      });

    // Cleanup koneksi agar tidak bocor saat komponen ditutup/pindah halaman
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

  // Handler Hapus Semua Pending
// Handler Hapus Semua Tamu Pre-Register (Ghost Booking)
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
        // 1. Pastikan hanya mengambil status SUCCESS atau CANCELLED
        if (!["SUCCESS", "CANCELLED"].includes(visitor.status)) return false;
        
        // 2. Jika filter "Semua Waktu" dipilih, langsung loloskan
        if (historyRange === "all") return true;

        // 3. Tentukan tanggal yang akan dibandingkan (Pakai checkOutTime jika ada, jika tidak pakai checkInTime)
        const compareDate = visitor.checkOutTime ? new Date(visitor.checkOutTime) : new Date(visitor.checkInTime || 0);

        // 4. Logika Filter Berdasarkan Rentang Waktu
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
      // 5. Urutkan dari yang paling baru selesai
      .sort((a, b) => new Date(b.checkOutTime || 0).getTime() - new Date(a.checkOutTime || 0).getTime());
  }, [data.visitors, historyRange]); // 👈 Pastikan historyRange masuk ke dalam array dependency ini

  // 👇 Bagian di bawah ini BIAKARKAN SAMA SEPERTI MILIK ANDA 👇
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
  const totalPages = Math.max(1, Math.ceil(filteredVisitors.length / pageSize));
  const visibleVisitors = filteredVisitors.slice((page - 1) * pageSize, page * pageSize);
  const activeQueueVisitor = queueVisitors.find((visitor) => visitor.status === "ON_PROGRESS") ?? queueVisitors[0] ?? null;
  const activeQueueIndex = activeQueueVisitor
    ? Math.max(0, queueVisitors.findIndex((visitor) => visitor.id === activeQueueVisitor.id))
    : 0;
  const queueCapacity = 40;
  const queueOccupancy = Math.min(queueVisitors.length, queueCapacity);
  const queueOccupancyPercent = Math.min(100, Math.round((queueOccupancy / queueCapacity) * 100));
  const totalPreRegister = queueVisitors.filter(v => v.status === "PRE_REGISTER").length;
// 1. Waktu Tunggu Pelanggan Aktif (yang sedang dilayani saat ini)
  const activeVisitorWaitSeconds = activeQueueVisitor && activeQueueVisitor.serviceStartTime
    ? Math.max(0, durationSeconds(activeQueueVisitor.checkInTime, activeQueueVisitor.serviceStartTime))
    : 0;

  // 2. Metrik Dinamis Riwayat (Mengikuti filter Hari/Bulan/Tahun, hanya hitung yang SUCCESS)
  const historyMetrics = useMemo(() => {
    const successOnly = historyVisitors.filter(v => v.status === "SUCCESS");
    
    // Rata-rata Rating
    const rated = successOnly.filter(v => v.rating && v.rating > 0);
    const avgRating = rated.length > 0 
      ? (rated.reduce((acc, v) => acc + (v.rating || 0), 0) / rated.length).toFixed(1) 
      : null;

    // Rata-rata Waktu Tunggu (dari Check In sampai mulai dilayani / Check Out)
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
      title: "Ringkasan Dashboard", // Tambahkan title di sini
      description: "Pantau antrean, sesi layanan, dan statistik penggunaan kiosk dalam satu tampilan.",
    },
    queue: {
      eyebrow: "Manajemen Antrean",
      title: "Antrean Kostumer", // Tambahkan title di sini
      description: "Kostumer pertama diproses sebagai sedang dilayani, sedangkan antrean berikutnya menunggu giliran.",
    },
    history: {
      eyebrow: "Riwayat Layanan",
      title: "Riwayat Kunjungan", // Tambahkan title di sini
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
  }[activeView];

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf7f5] text-[#2b211f]">
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
              <p className="text-sm text-xl font-semibold tracking-tight text-[#b3261e]">{viewCopy.eyebrow}</p>
              <p className="mt-2 max-w-2xl text-sm text-[#725b56]">
                {viewCopy.description}
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
              {activeView === "queue" && totalPreRegister > 0 && (
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
              onQueryChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              onSelectVisitor={setSelectedVisitorId}
              onStatusFilterChange={(value) => {
                setStatusFilter(value);
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

          {activeView === "pin" && (
            <div className="mt-6">
              <section className="min-w-0 rounded-2xl border border-[#f0dfdb] bg-white p-6 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-[#2b211f]">Form Pembuatan Token / PIN</h3>
                  <p className="mt-1 text-sm text-[#7a625d]">
                    Isi data pelanggan untuk menghasilkan PIN. Kostumer dapat memasukkan PIN ini di layar Kiosk untuk mempercepat proses pendaftaran tanpa harus mengetik ulang.
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
                          // Reset form setelah berhasil
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
                            showNotification("PIN berhasil disalin ke clipboard!", "success"); // 👈 DI SINI
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
                      
                      {/* 👇 INI ADALAH DROPDOWN FILTER WAKTU BARU 👇 */}
                      <select
                        value={historyRange}
                        onChange={(event) => {
                          setHistoryRange(event.target.value as "today" | "month" | "year" | "all");
                          setPage(1); // Reset halaman ke 1 saat filter berubah
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
                              <div className="flex items-center gap-1">
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
              onEdit={(visitor) => {
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
          onSubmit={(formData) => {
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

function QueueView({
  activeVisitor,
  activeVisitorIndex,
  averageWaitSeconds,
  connectionOk,
  filteredVisitors,
  onEdit,
  onNextPage,
  onPreviousPage,
  onPreview,
  onQueryChange,
  onSelectVisitor,
  onStatusFilterChange,
  page,
  pageSize,
  query,
  queueCapacity,
  queueOccupancy,
  queueOccupancyPercent,
  selectedVisitorId,
  statusFilter,
  totalPages,
  visibleVisitors,
}: {
  activeVisitor: AdminVisitor | null;
  activeVisitorIndex: number;
  averageWaitSeconds: number;
  connectionOk: boolean;
  filteredVisitors: AdminVisitor[];
  onEdit: (visitor: AdminVisitor) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPreview: (visitor: AdminVisitor) => void;
  onQueryChange: (value: string) => void;
  onSelectVisitor: (id: string) => void;
  onStatusFilterChange: (value: "ALL" | AdminVisitor["status"]) => void;
  page: number;
  pageSize: number;
  query: string;
  queueCapacity: number;
  queueOccupancy: number;
  queueOccupancyPercent: number;
  selectedVisitorId: string;
  statusFilter: "ALL" | AdminVisitor["status"];
  totalPages: number;
  visibleVisitors: AdminVisitor[];
}) {
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
        <QueueActiveSessionCard
          visitor={activeVisitor}
          visitorIndex={activeVisitorIndex}
          onPreview={onPreview}
        />
        <QueueStatsCard
          averageWaitSeconds={averageWaitSeconds}
          connectionOk={connectionOk}
          queueCapacity={queueCapacity}
          queueOccupancy={queueOccupancy}
          queueOccupancyPercent={queueOccupancyPercent}
        />
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[#f0dfdb] bg-white shadow-[0_18px_48px_rgba(70,31,25,0.07)]">
        <div className="flex flex-col gap-4 border-b border-[#f4e7e3] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[#3b302d]">Daftar Antrean</h3>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative block md:w-[320px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b8580]" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Cari kostumer..."
                className="h-11 w-full rounded-xl border border-[#fae1dc] bg-[#fff3f1] pl-10 pr-3 text-sm font-semibold text-[#3b302d] outline-none transition placeholder:text-[#b29d98] focus:border-[#d23a2f] focus:bg-white"
              />
            </label>

            <div className="grid h-11 grid-cols-3 rounded-xl bg-[#fff3f1] p-1 text-xs font-black text-[#7a625d] md:w-[290px]">
              {queueStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStatusFilterChange(option.value)}
                  className={`rounded-lg transition ${
                    statusFilter === option.value
                      ? "bg-white text-[#b3261e] shadow-[0_8px_20px_rgba(70,31,25,0.08)]"
                      : "hover:bg-white/70 hover:text-[#b3261e]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              title="Filter lanjutan"
              aria-label="Filter lanjutan"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#f0dfdb] bg-white text-[#6f5752] transition hover:bg-[#fff3f1] hover:text-[#b3261e]"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
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
              {visibleVisitors.map((visitor, index) => {
                const globalIndex = (page - 1) * pageSize + index;

                return (
                  <tr
                    key={visitor.id}
                    onClick={() => onSelectVisitor(visitor.id)}
                    className={`cursor-pointer transition hover:bg-[#fff7f5] ${
                      selectedVisitorId === visitor.id ? "bg-[#fff2ef]" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <VisitorAvatar visitor={visitor} size="sm" onPreview={onPreview} />
                        <div className="min-w-0">
                          <div className="truncate font-black text-[#3b302d]">{visitor.fullName}</div>
                          <div className="mt-0.5 text-xs font-bold text-[#9b8580]">
                            {visitorCode(visitor, globalIndex)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#7a625d] text-center">
                      {visitor.institution || "Instansi belum diisi"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <QueueCategoryLabel category={visitor.category} />
                    </td>
                    <td className="px-6 py-4 font-bold text-[#7a625d] text-center">{formatTime(visitor.checkInTime)}</td>
                    <td className="px-6 py-4 text-center">
                      <QueueStatusBadge status={visitor.status} />
                    </td>
                    <td className="px-6 py-4">
                      <QueueRowActions visitor={visitor} onEdit={onEdit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredVisitors.length === 0 && (
          <div className="px-5 py-14 text-center">
            <UsersRound className="mx-auto h-10 w-10 text-[#bba5a0]" />
            <p className="mt-3 font-bold text-[#6f5752]">Belum ada antrean sesuai filter.</p>
            <p className="text-sm text-[#806762]">Coba ubah pencarian atau status kunjungan.</p>
          </div>
        )}

        {filteredVisitors.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#f0dfdb] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#806762]">
              Menampilkan {showingFrom}-{showingTo} dari {filteredVisitors.length} data
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPreviousPage}
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
                onClick={onNextPage}
                disabled={page === totalPages}
                className="h-9 rounded-lg border border-[#f0dfdb] px-3 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}

        <Link
          href="/"
          title="Tambah kostumer"
          aria-label="Tambah kostumer"
          className="absolute bottom-5 right-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3261e] text-white shadow-[0_18px_32px_rgba(179,38,30,0.3)] transition hover:bg-[#cf3429]"
        >
          <Plus className="h-7 w-7" />
        </Link>
      </section>
    </div>
  );
}

function QueueActiveSessionCard({
  visitor,
  visitorIndex,
  onPreview,
}: {
  visitor: AdminVisitor | null;
  visitorIndex: number;
  onPreview: (visitor: AdminVisitor) => void;
}) {
  if (!visitor) {
    return (
      <section className="rounded-2xl border border-[#f0dfdb] bg-white p-7 shadow-[0_18px_48px_rgba(70,31,25,0.07)]">
        <div className="inline-flex rounded-lg bg-[#fff0ed] px-3 py-1 text-xs font-black uppercase text-[#b3261e]">
          Sesi Aktif
        </div>
        <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#f0dfdb] bg-[#fffaf9] text-center">
          <Headset className="h-10 w-10 text-[#bba5a0]" />
          <p className="mt-3 text-lg font-black text-[#3b302d]">Tidak ada sesi aktif</p>
          <p className="mt-1 text-sm font-semibold text-[#8b7671]">Kostumer berikutnya akan tampil setelah mulai dilayani.</p>
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
          <span className="inline-flex rounded-lg bg-[#fff0ed] px-3 py-1 text-xs font-black uppercase text-[#b3261e]">
            Sesi Aktif
          </span>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#332926]">
            Antrean {visitorCode(visitor, visitorIndex)}
          </h3>
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
          <p className="mt-1 text-sm font-bold text-[#7a625d]">
            {visitor.institution || "Instansi belum diisi"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-[#7a625d]">
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-[#3f6fb5]" />
              {visitor.category || "Umum"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-[#8b7671]" />
              Datang pukul {formatTime(visitor.checkInTime)}
            </span>
          </div>
        </div>
      </div>

      <div className="my-6 h-px bg-[#f5e8e4]" />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <form action={completeVisit}>
          <input type="hidden" name="id" value={visitor.id} />
          <button
            type="submit"
            disabled={!canComplete}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b3261e] text-sm font-black text-white shadow-[0_16px_28px_rgba(179,38,30,0.24)] transition hover:bg-[#cf3429] disabled:cursor-not-allowed disabled:bg-[#d8c2bd] disabled:shadow-none"
          >
            <CheckCircle2 className="h-5 w-5" />
            Tandai selesai
          </button>
        </form>

        <Link
          href="/admin/live"
          title="Bantuan live"
          aria-label="Bantuan live"
          className="inline-flex h-12 items-center justify-center rounded-xl border-2 border-[#d9b8b2] bg-white text-[#7a625d] transition hover:border-[#b3261e] hover:bg-[#fff3f1] hover:text-[#b3261e]"
        >
          <PhoneCall className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function QueueStatsCard({
  averageWaitSeconds,
  connectionOk,
  queueCapacity,
  queueOccupancy,
  queueOccupancyPercent,
}: {
  averageWaitSeconds: number;
  connectionOk: boolean;
  queueCapacity: number;
  queueOccupancy: number;
  queueOccupancyPercent: number;
}) {
  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_18px_48px_rgba(70,31,25,0.07)] sm:p-7">
      <h3 className="text-lg font-black text-[#3b302d]">Ringkasan Cepat</h3>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl bg-[#fff0ed] p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#7a625d]">Waktu Tunggu (Pelanggan Aktif)</p>
              <p className="mt-1 text-2xl font-black text-[#3f6fb5]">{formatCompactDuration(averageWaitSeconds)}</p>
            </div>
            {averageWaitSeconds < 5 ? (
              <span className="text-xs font-black text-[#62b47d]">Langsung</span>
            ) : (
              <span className="text-xs font-black text-[#b07926]">Menunggu</span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#fff7f4] p-4">
          <p className="text-xs font-black text-[#7a625d]">Kapasitas Antrean</p>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-2xl font-black text-[#3b302d]">
              {queueOccupancy}/{queueCapacity}
            </p>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e5bcb5]">
              <div
                className="h-full rounded-full bg-[#b3261e]"
                style={{ width: `${queueOccupancyPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#f8ded9] p-4">
          <p className="text-xs font-black text-[#7a625d]">Kondisi Sistem</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-black text-[#3b302d]">
            <span className={`h-2.5 w-2.5 rounded-full ${connectionOk ? "bg-[#62b47d]" : "bg-[#f2ae3f]"}`} />
            {connectionOk ? "Semua layanan beroperasi" : "Basis data tidak aktif"}
          </div>
        </div>
      </div>
    </section>
  );
}

function VisitorAvatar({
  visitor,
  size,
  onPreview,
}: {
  visitor: AdminVisitor;
  size: "sm" | "lg";
  onPreview: (visitor: AdminVisitor) => void;
}) {
  const sizeClass = size === "lg" ? "h-20 w-20 rounded-2xl" : "h-10 w-10 rounded-full";
  const textClass = size === "lg" ? "text-xl" : "text-xs";

  if (visitor.photoUrl) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPreview(visitor);
        }}
        className={`${sizeClass} shrink-0 overflow-hidden bg-[#fff0ed]`}
        aria-label={`Lihat foto ${visitor.fullName}`}
      >
        <Image
          src={visitor.photoUrl}
          alt={visitor.fullName}
          width={size === "lg" ? 80 : 40}
          height={size === "lg" ? 80 : 40}
          unoptimized
          className="h-full w-full object-cover"
        />
      </button>
    );
  }

  return (
    <div className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center bg-[#fff0ed] font-black text-[#b3261e]`}>
      {visitorInitials(visitor.fullName)}
    </div>
  );
}

function QueueCategoryLabel({ category }: { category: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-black text-[#3f6fb5]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#3f6fb5]" />
      {category || "Umum"}
    </span>
  );
}

function QueueStatusBadge({ status }: { status: AdminVisitor["status"] }) {
  if (status === "ON_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8edff] px-3 py-1 text-xs font-black text-[#5865d9]">
        <RefreshCw className="h-3 w-3" />
        Sedang Dilayani
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff3d9] px-3 py-1 text-xs font-black text-[#c88717]">
        <Clock3 className="h-3 w-3" />
        Menunggu
      </span>
    );
  }

  return <StatusBadge status={status} />;
}

function QueueRowActions({
  visitor,
  onEdit,
}: {
  visitor: AdminVisitor;
  onEdit: (visitor: AdminVisitor) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        title="Edit kostumer"
        aria-label="Edit kostumer"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(visitor);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b3261e] transition hover:bg-[#fff0ed]"
      >
        <Pencil className="h-4 w-4" />
      </button>

      {["PENDING", "ON_PROGRESS"].includes(visitor.status) && (
        <form action={cancelVisit}>
          <input type="hidden" name="id" value={visitor.id} />
          <button
            type="submit"
            title="Batalkan"
            aria-label="Batalkan"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b3261e] transition hover:bg-[#fff0ed] hover:text-[#7a625e]"
          >
            <Ban className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function TrafficPanel({
  activeRange,
  onRangeChange,
  dailyData,
  monthlyData,
  yearlyData,
}: {
  activeRange: "daily" | "monthly" | "yearly";
  onRangeChange: (range: "daily" | "monthly" | "yearly") => void;
  dailyData: Array<{ label: string; value: number }>;
  monthlyData: Array<{ label: string; value: number }>;
  yearlyData: Array<{ label: string; value: number }>;
}) {
  const rangeOptions = [
    { value: "daily", label: "Harian", data: dailyData },
    { value: "monthly", label: "Bulanan", data: monthlyData },
    { value: "yearly", label: "Tahunan", data: yearlyData },
  ] as const;
  const data = rangeOptions.find((option) => option.value === activeRange)?.data ?? dailyData;
  const chartWidth = 760;
  const chartHeight = 260;
  const paddingX = 30;
  const paddingTop = 26;
  const paddingBottom = 42;
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const xStep = data.length > 1 ? (chartWidth - paddingX * 2) / (data.length - 1) : 0;
  const xFor = (index: number) => paddingX + xStep * index;
  const yFor = (value: number) =>
    chartHeight - paddingBottom - (value / maxValue) * (chartHeight - paddingTop - paddingBottom);
  const points = data.map((item, index) => ({ ...item, x: xFor(index), y: yFor(item.value) }));
  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;

      const previous = points[index - 1];
      const controlOffset = xStep * 0.45;
      return `C ${previous.x + controlOffset} ${previous.y}, ${point.x - controlOffset} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Statistik Kunjungan</h3>
        </div>
        <div className="grid h-12 grid-cols-3 rounded-xl bg-[#fdebe7] p-1 text-sm font-bold text-[#6f5752] sm:w-[340px]">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRangeChange(option.value)}
              className={`rounded-lg transition ${
                activeRange === option.value
                  ? "bg-white text-[#b3261e] shadow-[0_8px_18px_rgba(70,31,25,0.08)]"
                  : "hover:bg-white/45 hover:text-[#b3261e]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-72">
        {data.length > 0 ? (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img">
            {points.map((point) => (
              <line
                key={`traffic-guide-${point.label}`}
                x1={point.x}
                x2={point.x}
                y1={paddingTop + 12}
                y2={chartHeight - paddingBottom + 18}
                stroke="#f4e3df"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}

            <path
              d={linePath}
              fill="none"
              stroke="#b3261e"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point) => (
              <g key={`traffic-point-${point.label}`}>
                <circle cx={point.x} cy={point.y} r="8" fill="#b3261e" />
                <text
                  x={point.x}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="fill-[#a8918c] text-[13px] font-bold"
                >
                  {point.label}
                </text>
                <text
                  x={point.x}
                  y={Math.max(18, point.y - 16)}
                  textAnchor="middle"
                  className="fill-[#b3261e] text-[13px] font-bold"
                >
                  {point.value}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-[#806762]">
            Belum ada data statistik.
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryChart({
  categories,
}: {
  categories: AdminDashboardData["categories"];
}) {
  const colors = ["#b3261e", "#e4a63a", "#62b47d", "#5865d9", "#a05aa6"];
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const chartSegments = categories.reduce<{
    offset: number;
    segments: Array<{
      dashArray: string;
      dashOffset: number;
      item: AdminDashboardData["categories"][number];
      stroke: string;
    }>;
  }>(
    (accumulator, item, index) => {
      const segment = total > 0 ? (item.count / total) * circumference : 0;

      return {
        offset: accumulator.offset + segment,
        segments: [
          ...accumulator.segments,
          {
            dashArray: `${segment} ${circumference - segment}`,
            dashOffset: -accumulator.offset,
            item,
            stroke: colors[index % colors.length],
          },
        ],
      };
    },
    { offset: 0, segments: [] },
  ).segments;

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#2b211f]">Kategori Teratas</h3>
          <p className="mt-1 text-sm text-[#806762]">Distribusi kategori kunjungan.</p>
        </div>
        <div className="rounded-xl bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#b3261e]">
          {total}
        </div>
      </div>

      {categories.length > 0 && total > 0 ? (
        <div className="mt-5">
          <div className="relative mx-auto aspect-square max-w-[260px]">
            <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" role="img">
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="#fff0ed"
                strokeWidth="28"
              />
              {chartSegments.map(({ dashArray, dashOffset, item, stroke }) => {
                return (
                  <circle
                    key={item.name}
                    cx="110"
                    cy="110"
                    r={radius}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="28"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-bold text-[#2b211f]">{total}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Kunjungan</span>
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {categories.map((item, index) => (
              <div key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="truncate font-semibold text-[#725b56]">{item.name}</span>
                </div>
                <span className="font-bold text-[#2b211f]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 flex h-64 items-center justify-center rounded-xl border border-[#f0dfdb] bg-[#fff8f6] text-sm text-[#806762]">
          Grafik kategori akan muncul setelah data tersedia.
        </div>
      )}
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
  const colors = ["#b3261e", "#5865d9", "#62b47d", "#e4a63a", "#a05aa6"];
  const labels = series[0]?.data.map((item) => item.label) ?? [];
  const maxValue = Math.max(1, ...series.flatMap((item) => item.data.map((point) => point.value)));
  const xStep = labels.length > 1 ? (chartWidth - padding * 2) / (labels.length - 1) : 0;
  const yFor = (value: number) =>
    chartHeight - padding - (value / maxValue) * (chartHeight - padding * 2);
  const xFor = (index: number) => padding + xStep * index;

  return (
    <section className="rounded-2xl border border-[#f0dfdb] bg-white p-5 shadow-[0_16px_42px_rgba(70,31,25,0.06)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Permasalahan Paling Sering</h3>
          <p className="mt-1 text-sm text-[#806762]">Tren kategori kunjungan dalam 6 bulan terakhir.</p>
        </div>
        <Activity className="h-5 w-5 text-[#b3261e]" />
      </div>
      <div className="mt-6">
        {series.length > 0 ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[#f0dfdb] bg-[#fff8f6]">
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
                      stroke="#f1dfdb"
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
                    className="fill-[#806762] text-[12px] font-bold"
                  >
                    {label}
                  </text>
                ))}
              </svg>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {series.map((item, index) => (
                <div key={item.name} className="inline-flex items-center gap-2 text-sm font-semibold text-[#725b56]">
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
          <div className="flex h-64 items-center justify-center rounded-xl border border-[#f0dfdb] bg-[#fff8f6] text-sm text-[#806762]">
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
  href,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className = `flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
    active
      ? "bg-[#cf3429] text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)]"
      : "text-[#6f5752] hover:bg-[#fff0ed] hover:text-[#b3261e]"
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
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
    red: "bg-[#b3261e]/10 text-[#b3261e]",
    green: "bg-[#62b47d]/12 text-[#4e9b70]",
    blue: "bg-[#5865d9]/10 text-[#5865d9]",
    amber: "bg-[#e4a63a]/12 text-[#b07926]",
  };

  return (
    <section className="rounded-xl border border-[#f0dfdb] bg-white p-4 shadow-[0_16px_34px_rgba(70,31,25,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#806762]">{title}</p>
          <div className="mt-2 text-3xl font-bold text-[#2b211f]">{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: AdminVisitor["status"] }) {
  if (status === "ON_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9dd] bg-[#eefbf4] px-2.5 py-1 text-xs font-bold text-[#4e9b70]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#62c48a]" />
        Sedang Dilayani
      </span>
    );
  }

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f4ddb5] bg-[#fff8eb] px-2.5 py-1 text-xs font-bold text-[#b07926]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#f2ae3f]" />
        Menunggu
      </span>
    );
  }

  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#efc6c0] bg-[#fff0ed] px-2.5 py-1 text-xs font-bold text-[#b3261e]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#cf3429]" />
        Dibatalkan
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe9dd] bg-[#eefbf4] px-2.5 py-1 text-xs font-bold text-[#4e9b70]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#62c48a]" />
      Selesai
    </span>
  );
}

function VisitorDetail({
  selectedVisitor,
  onPreview,
  onEdit,
  isHistory,
}: {
  selectedVisitor: AdminVisitor | null;
  onPreview: (visitor: AdminVisitor) => void;
  onEdit: (visitor: AdminVisitor) => void;
  isHistory?: boolean;
}) {
  return (
    <section className="w-full rounded-3xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#2b211f]">{isHistory ? "Detail Kostumer" : "Sesi Aktif"}</h3>
          <p className="mt-1 text-sm text-[#7a625d]">Informasi lengkap yang hanya muncul setelah menekan tombol View.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase text-white ${isHistory ? "bg-[#5865d9]" : "bg-[#b3261e]"}`}>
          {isHistory ? "Riwayat" : "Langsung"}
        </span>
      </div>

      {selectedVisitor ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[112px_1fr]">
            <div className="flex items-center justify-center rounded-3xl bg-[#f7f3f1] p-4">
              {selectedVisitor.photoUrl ? (
                <button
                  type="button"
                  onClick={() => onPreview(selectedVisitor)}
                  className="block overflow-hidden rounded-3xl"
                  aria-label={`Lihat foto ${selectedVisitor.fullName}`}
                >
                  <Image
                    src={selectedVisitor.photoUrl}
                    alt={selectedVisitor.fullName}
                    width={112}
                    height={112}
                    unoptimized
                    className="h-28 w-28 object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-[#bba5a0]">
                  <UserRound className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[#7a625d]">{selectedVisitor.institution || "Tanpa instansi"}</p>
                <h4 className="text-2xl font-bold text-[#2b211f]">{selectedVisitor.fullName}</h4>
              </div>
              <StatusBadge status={selectedVisitor.status} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile
              icon={Clock3}
              label="Durasi"
              value={elapsedLabel(selectedVisitor.serviceStartTime || selectedVisitor.checkInTime)}
            />
            <InfoTile icon={Star} label="Penilaian" value={selectedVisitor.rating ? `${selectedVisitor.rating}/5` : "-"} />
          </div>

          <div className="rounded-3xl border border-[#ece0dc] bg-[#fcf8f6] p-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Kategori" value={selectedVisitor.category || "Umum"} />
              <DetailRow label="Petugas" value={selectedVisitor.hostName || "-"} />
              <DetailRow label="Telepon" value={selectedVisitor.phoneNumber || "-"} />
              <DetailRow label="Nomor Internet" value={selectedVisitor.internetNumber || "-"} />
            </div>
            <div className="mt-4 flex items-start gap-2 text-[#7a625d]">
              <MapPin className="mt-0.5 h-4 w-4 text-[#b3261e]" />
              <span>{selectedVisitor.address || "Alamat belum diisi"}</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#7a625d]">Keperluan</p>
            <p className="rounded-3xl border border-[#ece0dc] bg-[#faf6f4] p-4 text-sm text-[#3c302d]">{selectedVisitor.purpose || "-"}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selectedVisitor.photoUrl && onPreview(selectedVisitor)}
              disabled={!selectedVisitor.photoUrl}
              title="Lihat pratinjau foto"
              aria-label="Lihat pratinjau foto"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#b3261e] text-white transition hover:bg-[#a02a24] disabled:cursor-not-allowed disabled:bg-[#d3b8b3]"
            >
              <Eye className="h-5 w-5" />
              <span className="ml-2">Lihat Foto</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(selectedVisitor)}
              title="Edit informasi tamu"
              aria-label="Edit informasi tamu"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#b3261e] bg-white text-[#b3261e] transition hover:bg-[#fff4f2]"
            >
              <Pencil className="h-5 w-5" />
              <span className="ml-2">Edit</span>
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-3xl border border-[#ece0dc] bg-[#faf7f4] p-6 text-center text-sm text-[#7a625d]">Pilih salah satu tamu untuk melihat detail.</p>
      )}
    </section>
  );
}

function EditVisitorDialog({
  visitor,
  isSaving,
  onClose,
  onSubmit,
}: {
  visitor: AdminVisitor;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b211f]/70 p-4 backdrop-blur-md">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#f0dfdb] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#f0dfdb] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#2b211f]">Edit Informasi Pelanggan</h2>
            <p className="text-sm text-[#806762]">Durasi dan rating tidak dapat diedit dari form ini.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#f0dfdb] text-[#806762] transition hover:bg-[#fff3f0] hover:text-[#2b211f]"
            aria-label="Tutup form edit pelanggan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex max-h-[calc(92vh-73px)] flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
          }}
        >
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

            <div className="mt-4 grid gap-3 rounded-xl border border-[#f0dfdb] bg-[#fff8f6] p-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Durasi</p>
                <p className="mt-1 font-bold text-[#3c302d]">
                  {elapsedLabel(visitor.serviceStartTime || visitor.checkInTime)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">Penilaian</p>
                <p className="mt-1 font-bold text-[#3c302d]">{visitor.rating ? `${visitor.rating}/5` : "-"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#f0dfdb] bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 rounded-xl border border-[#f0dfdb] px-5 text-sm font-bold text-[#6f5752] transition hover:bg-[#fff3f0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-11 rounded-xl bg-[#b3261e] px-5 text-sm font-bold text-white shadow-[0_18px_30px_rgba(179,38,30,0.22)] transition hover:bg-[#cf3429] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="h-11 rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 text-sm font-semibold text-[#2b211f] outline-none transition placeholder:text-[#a8918c] focus:border-[#d23a2f] focus:bg-white"
      />
    </label>
  );
}

function EditTextarea({
  label,
  name,
  defaultValue,
  rows,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        required={required}
        className="resize-none rounded-xl border border-[#f0dfdb] bg-[#fff8f6] px-3 py-3 text-sm font-semibold text-[#2b211f] outline-none transition placeholder:text-[#a8918c] focus:border-[#d23a2f] focus:bg-white"
      />
    </label>
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
    <div className="rounded-xl border border-[#f0dfdb] bg-[#fff8f6] p-3">
      <Icon className="mb-2 h-4 w-4 text-[#b3261e]" />
      <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</p>
      <p className="mt-1 break-words font-bold text-[#3c302d]">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#806762]">{label}</p>
      <p className="mt-1 text-[#6f5752]">{value}</p>
    </div>
  );
}
