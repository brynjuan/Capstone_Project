import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";
import { AdminDashboardData } from "./types"; 
import { VisitStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfYear = () => {
  const date = new Date();
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfDayOffset = (offset: number) => {
  const date = startOfToday();
  date.setDate(date.getDate() + offset);
  return date;
};

const startOfMonthOffset = (offset: number) => {
  const date = startOfMonth();
  date.setMonth(date.getMonth() + offset);
  return date;
};

const startOfYearOffset = (offset: number) => {
  const date = startOfYear();
  date.setFullYear(date.getFullYear() + offset);
  return date;
};

const toIso = (date: Date | null) => (date ? date.toISOString() : null);

const dayLabel = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(date);

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "Asia/Makassar",
  }).format(date);

// 👇 FUNGSI SEKARANG MENERIMA DATA ADMIN UNTUK FILTER DAERAH 👇
async function getDashboardData(admin: { role: string; region: string | null }): Promise<AdminDashboardData> {
  const today = startOfToday();
  const month = startOfMonth();
  const year = startOfYear();
  
  // 🔐 FILTER DAERAH: Jika Superadmin, kosongkan filter (lihat semua). Jika Admin biasa, wajib sesuai daerahnya.
  const regionFilter = admin.role === "SUPERADMIN" ? {} : { region: admin.region || "" };

  const dailyRanges = Array.from({ length: 7 }, (_, index) => {
    const start = startOfDayOffset(index - 6);
    const end = startOfDayOffset(index - 5);
    return { label: dayLabel(start), start, end };
  });
  const monthlyRanges = Array.from({ length: 6 }, (_, index) => {
    const start = startOfMonthOffset(index - 5);
    const end = startOfMonthOffset(index - 4);
    return { label: monthLabel(start), start, end };
  });
  const yearlyRanges = Array.from({ length: 4 }, (_, index) => {
    const start = startOfYearOffset(index - 3);
    const end = startOfYearOffset(index - 2);
    return { label: String(start.getFullYear()), start, end };
  });

  try {
    // Terapkan regionFilter ke SEMUA pencarian database
    const activeVisitors = await prisma.visitorLog.findMany({
      where: { 
        status: { in: [VisitStatus.PRE_REGISTER, VisitStatus.PENDING, VisitStatus.ON_PROGRESS] }, 
        ...regionFilter 
      },
      orderBy: { checkInTime: "asc" },
    });

    const historyVisitors = await prisma.visitorLog.findMany({
      where: { 
        status: { in: [VisitStatus.SUCCESS, VisitStatus.CANCELLED] }, 
        ...regionFilter 
      },
      orderBy: { checkOutTime: "desc" },
      take: 100, // Dikurangi dari 1000 ke 100 untuk menghemat egress
    });

    const visitors = [...activeVisitors, ...historyVisitors];

    const totalToday = await prisma.visitorLog.count({
      where: { checkInTime: { gte: today }, ...regionFilter },
    });

    const totalMonth = await prisma.visitorLog.count({
      where: { checkInTime: { gte: month }, ...regionFilter },
    });

    const totalYear = await prisma.visitorLog.count({
      where: { checkInTime: { gte: year }, ...regionFilter },
    });

    const pendingVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.PENDING, ...regionFilter },
    });

    const onProgressVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.ON_PROGRESS, ...regionFilter },
    });

    const successVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.SUCCESS, ...regionFilter },
    });

    const completedToday = await prisma.visitorLog.count({
      where: {
        status: VisitStatus.SUCCESS,
        checkOutTime: { gte: today },
        ...regionFilter,
      },
    });

    const ratingAggregate = await prisma.visitorLog.aggregate({
      where: { rating: { not: null }, ...regionFilter },
      _avg: { rating: true },
    });

    const categoryGroups = await prisma.visitorLog.groupBy({
      by: ["category"],
      where: { ...regionFilter },
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 8,
    });

    // --- OPTIMIZATION: USE RAW SQL FOR CHARTS ---
    const regionCondition = admin.role === "SUPERADMIN" 
      ? Prisma.empty 
      : Prisma.sql`AND region = ${admin.region || ""}`;

    // Helper formatter to match DB TO_CHAR output
    const toDateStr = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(date);
    const toMonthStr = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit' }).formatToParts(date);
      return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
    };
    const toYearStr = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric' }).format(date);

    const dailyCounts = await prisma.$queryRaw<{ day_start: string; category: string | null; count: bigint }[]>`
      SELECT 
        TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD') as day_start,
        category,
        COUNT(*) as count
      FROM visitor_logs
      WHERE "checkInTime" >= ${dailyRanges[0].start}
      ${regionCondition}
      GROUP BY TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD'), category
    `;

    const monthlyCounts = await prisma.$queryRaw<{ month_start: string; category: string | null; count: bigint }[]>`
      SELECT 
        TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-FM02') as month_start,
        category,
        COUNT(*) as count
      FROM visitor_logs
      WHERE "checkInTime" >= ${monthlyRanges[0].start}
      ${regionCondition}
      GROUP BY TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-FM02'), category
    `;

    const yearlyCounts = await prisma.$queryRaw<{ year_start: string; category: string | null; count: bigint }[]>`
      SELECT 
        TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY') as year_start,
        category,
        COUNT(*) as count
      FROM visitor_logs
      WHERE "checkInTime" >= ${yearlyRanges[0].start}
      ${regionCondition}
      GROUP BY TO_CHAR("checkInTime" AT TIME ZONE 'Asia/Makassar', 'YYYY'), category
    `;

    // Process General Series (sum of all categories)
    const dailySeries = dailyRanges.map(range => {
      const dateStr = toDateStr(range.start);
      const total = dailyCounts.filter(r => r.day_start === dateStr).reduce((acc, curr) => acc + Number(curr.count), 0);
      return { label: range.label, value: total };
    });

    const monthlySeries = monthlyRanges.map(range => {
      const monthStr = toMonthStr(range.start);
      const total = monthlyCounts.filter(r => r.month_start === monthStr).reduce((acc, curr) => acc + Number(curr.count), 0);
      return { label: range.label, value: total };
    });

    const yearlySeries = yearlyRanges.map(range => {
      const yearStr = toYearStr(range.start);
      const total = yearlyCounts.filter(r => r.year_start === yearStr).reduce((acc, curr) => acc + Number(curr.count), 0);
      return { label: range.label, value: total };
    });

    // Process Category Series
    const topCategories = categoryGroups.map((item) => item.category);
    const categoryDailySeries = [];
    const categoryMonthlySeries = [];
    const categoryYearlySeries = [];
    
    for (const category of topCategories) {
      categoryDailySeries.push({ 
        name: category || "Tanpa kategori", 
        data: dailyRanges.map(range => {
          const dateStr = toDateStr(range.start);
          const val = dailyCounts.find(r => r.day_start === dateStr && r.category === category);
          return { label: range.label, value: val ? Number(val.count) : 0 };
        })
      });

      categoryMonthlySeries.push({ 
        name: category || "Tanpa kategori", 
        data: monthlyRanges.map(range => {
          const monthStr = toMonthStr(range.start);
          const val = monthlyCounts.find(r => r.month_start === monthStr && r.category === category);
          return { label: range.label, value: val ? Number(val.count) : 0 };
        })
      });

      categoryYearlySeries.push({ 
        name: category || "Tanpa kategori", 
        data: yearlyRanges.map(range => {
          const yearStr = toYearStr(range.start);
          const val = yearlyCounts.find(r => r.year_start === yearStr && r.category === category);
          return { label: range.label, value: val ? Number(val.count) : 0 };
        })
      });
    }
    
    // Process Peak Hours Series directly from DB
    const peakHoursDailySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
    const peakHoursMonthlySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
    const peakHoursYearlySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));

    const peakHoursQuery = await prisma.$queryRaw<{ hour: number; total: bigint; today: bigint; month: bigint }[]>`
      SELECT 
        EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'Asia/Makassar')::int as hour,
        COUNT(*) as total,
        SUM(CASE WHEN "checkInTime" >= ${today} THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN "checkInTime" >= ${month} THEN 1 ELSE 0 END) as month
      FROM visitor_logs
      WHERE "checkInTime" >= ${year}
      ${regionCondition}
      GROUP BY EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'Asia/Makassar')
    `;

    for (const row of peakHoursQuery) {
      if (row.hour >= 7 && row.hour <= 17) {
        const index = row.hour - 7;
        peakHoursYearlySeries[index].value = Number(row.total);
        peakHoursMonthlySeries[index].value = Number(row.month);
        peakHoursDailySeries[index].value = Number(row.today);
      }
    }

    const cancelledVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.CANCELLED, ...regionFilter }
    });

    const completionRatio = {
      success: successVisits,
      cancelled: cancelledVisits
    };

    // Ambil setting kiosk sesuai wilayah admin (jika Superadmin, default ke "global" atau region pertama yg di klik)
    const targetRegion = admin.region || "global";
    const kioskSetting = await prisma.kioskSetting.findUnique({
      where: { id: targetRegion }
    });

    return {
      connectionOk: true,
      visitors: visitors.map((visitor) => ({
        id: visitor.id,
        createdAt: toIso(visitor.checkInTime),
        fullName: visitor.fullName,
        phoneNumber: visitor.phoneNumber,
        institution: visitor.institution,
        internetNumber: visitor.internetNumber,
        address: visitor.address,
        category: visitor.category,
        purpose: visitor.purpose,
        hostName: visitor.hostName,
        photoUrl: visitor.photoUrl,
        status: visitor.status,
        checkInTime: toIso(visitor.checkInTime),
        serviceStartTime: toIso(visitor.serviceStartTime),
        checkOutTime: toIso(visitor.checkOutTime),
        rating: visitor.rating,
      })),
      metrics: {
        totalToday,
        totalMonth,
        totalYear,
        pendingVisits,
        onProgressVisits,
        successVisits,
        completedToday,
        averageRating: ratingAggregate._avg.rating ?? null,
      },
      categories: categoryGroups.map((item) => ({
        name: item.category || "Tanpa kategori",
        count: item._count.category,
      })),
      dailySeries,
      monthlySeries,
      yearlySeries,
      categoryDailySeries,
      categoryMonthlySeries,
      categoryYearlySeries,
      peakHoursDailySeries,
      peakHoursMonthlySeries,
      peakHoursYearlySeries,
      completionRatio,
      kioskStatus: {
        isBusy: kioskSetting?.isBusy ?? false,
        message: kioskSetting?.message ?? "",
      }
    };
  } catch (error) {
    console.error("Gagal mengambil data admin:", error);
    return {
      connectionOk: false,
      visitors: [],
      metrics: { totalToday: 0, totalMonth: 0, totalYear: 0, pendingVisits: 0, onProgressVisits: 0, successVisits: 0, completedToday: 0, averageRating: null, },
      categories: [], dailySeries: [], monthlySeries: [], yearlySeries: [], 
      categoryDailySeries: [], categoryMonthlySeries: [], categoryYearlySeries: [],
      peakHoursDailySeries: [], peakHoursMonthlySeries: [], peakHoursYearlySeries: [], 
      completionRatio: { success: 0, cancelled: 0 },
      kioskStatus: { isBusy: false, message: "" }
    };
  }
}

export default async function AdminPage() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  // 🔐 USIR AKUN KIOSK: Jika yang login adalah KIOSK, lempar kembali ke layar depan!
  if (admin.role === "KIOSK") {
    redirect("/");
  }

  // Kirim data admin ke fungsi getDashboardData untuk di-filter
  const data = await getDashboardData(admin);

  return <AdminDashboard data={data} admin={admin as any} />;
}