import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDashboard, { type AdminDashboardData } from "./AdminDashboard";
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

async function getDashboardData(): Promise<AdminDashboardData> {
  const today = startOfToday();
  const month = startOfMonth();
  const year = startOfYear();
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
    // 1. Eksekusi metrik utama secara berurutan (sekuensial)
    // Menghindari error EMAXCONNSESSION (max clients pool_size: 15)
    
    const visitors = await prisma.visitorLog.findMany({
      orderBy: [{ status: "asc" }, { checkInTime: "desc" }],
      take: 200,
    });

    const totalToday = await prisma.visitorLog.count({
      where: { checkInTime: { gte: today } },
    });

    const totalMonth = await prisma.visitorLog.count({
      where: { checkInTime: { gte: month } },
    });

    const totalYear = await prisma.visitorLog.count({
      where: { checkInTime: { gte: year } },
    });

    const pendingVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.PENDING },
    });

    const onProgressVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.ON_PROGRESS },
    });

    const successVisits = await prisma.visitorLog.count({
      where: { status: VisitStatus.SUCCESS },
    });

    const completedToday = await prisma.visitorLog.count({
      where: {
        status: VisitStatus.SUCCESS,
        checkOutTime: { gte: today },
      },
    });

    const ratingAggregate = await prisma.visitorLog.aggregate({
      where: { rating: { not: null } },
      _avg: { rating: true },
    });

    const categoryGroups = await prisma.visitorLog.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 5,
    });

    // 2. Eksekusi grafik/series secara berurutan
    const dailySeries = [];
    for (const range of dailyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end } },
      });
      dailySeries.push({ label: range.label, value: count });
    }

    const monthlySeries = [];
    for (const range of monthlyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end } },
      });
      monthlySeries.push({ label: range.label, value: count });
    }

    const yearlySeries = [];
    for (const range of yearlyRanges) {
      const count = await prisma.visitorLog.count({
        where: { checkInTime: { gte: range.start, lt: range.end } },
      });
      yearlySeries.push({ label: range.label, value: count });
    }

    // 3. Eksekusi grafik kategori bulanan secara berurutan
    const topCategories = categoryGroups.map((item) => item.category);
    const categoryMonthlySeries = [];
    
    for (const category of topCategories) {
      const data = [];
      for (const range of monthlyRanges) {
        const count = await prisma.visitorLog.count({
          where: {
            category,
            checkInTime: { gte: range.start, lt: range.end },
          },
        });
        data.push({ label: range.label, value: count });
      }
      
      categoryMonthlySeries.push({
        name: category || "Tanpa kategori",
        data,
      });
    }

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
      categoryMonthlySeries,
    };
  } catch (error) {
    console.error("Gagal mengambil data admin:", error);

    return {
      connectionOk: false,
      visitors: [],
      metrics: {
        totalToday: 0,
        totalMonth: 0,
        totalYear: 0,
        pendingVisits: 0,
        onProgressVisits: 0,
        successVisits: 0,
        completedToday: 0,
        averageRating: null,
      },
      categories: [],
      dailySeries: [],
      monthlySeries: [],
      yearlySeries: [],
      categoryMonthlySeries: [],
    };
  }
}

export default async function AdminPage() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  const data = await getDashboardData();

  return <AdminDashboard data={data} admin={admin} />;
}