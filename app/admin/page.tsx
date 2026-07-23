import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";
import { AdminDashboardData } from "./types"; 
import { VisitStatus } from "@prisma/client";

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
    const visitors = await prisma.visitorLog.findMany({
      where: { ...regionFilter },
      orderBy: [{ status: "asc" }, { checkInTime: "desc" }],
      take: 200,
    });

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

    const dailySeries = [];
    for (const range of dailyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
      });
      dailySeries.push({ label: range.label, value: count });
    }

    const monthlySeries = [];
    for (const range of monthlyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
      });
      monthlySeries.push({ label: range.label, value: count });
    }

    const yearlySeries = [];
    for (const range of yearlyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
      });
      yearlySeries.push({ label: range.label, value: count });
    }

    const topCategories = categoryGroups.map((item) => item.category);
    const categoryDailySeries = [];
    const categoryMonthlySeries = [];
    const categoryYearlySeries = [];
    
    for (const category of topCategories) {
      const dataDaily = [];
      for (const range of dailyRanges) {
        const count = await prisma.visitorLog.count({
          where: { category, checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
        });
        dataDaily.push({ label: range.label, value: count });
      }
      categoryDailySeries.push({ name: category || "Tanpa kategori", data: dataDaily });

      const dataMonthly = [];
      for (const range of monthlyRanges) {
        const count = await prisma.visitorLog.count({
          where: { category, checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
        });
        dataMonthly.push({ label: range.label, value: count });
      }
      categoryMonthlySeries.push({ name: category || "Tanpa kategori", data: dataMonthly });

      const dataYearly = [];
      for (const range of yearlyRanges) {
        const count = await prisma.visitorLog.count({
          where: { category, checkInTime: { gte: range.start, lt: range.end }, ...regionFilter },
        });
        dataYearly.push({ label: range.label, value: count });
      }
      categoryYearlySeries.push({ name: category || "Tanpa kategori", data: dataYearly });
    }

    const allVisitsThisYear = await prisma.visitorLog.findMany({
      where: { checkInTime: { gte: year }, ...regionFilter },
      select: { checkInTime: true }
    });
    
    const peakHoursDailySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
    const peakHoursMonthlySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
    const peakHoursYearlySeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
    
    for (const visit of allVisitsThisYear) {
      if (visit.checkInTime) {
        const dateStr = visit.checkInTime.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
        const hour = new Date(dateStr).getHours();
        
        if (hour >= 7 && hour <= 17) {
          const index = hour - 7;
          peakHoursYearlySeries[index].value += 1;
          
          if (visit.checkInTime >= month) {
            peakHoursMonthlySeries[index].value += 1;
          }
          
          if (visit.checkInTime >= today) {
            peakHoursDailySeries[index].value += 1;
          }
        }
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