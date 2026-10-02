"use server";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function getCustomPeakHours(rangeType: string, dateStr: string) {
  const admin = await getAdminSession();
  if (!admin) return [];
  
  const regionCondition = admin.role === "SUPERADMIN" 
    ? Prisma.empty 
    : Prisma.sql`AND region = ${admin.region || ""}`;

  let dateQuery = Prisma.empty;

  if (rangeType === "monthly" && dateStr) {
    const [y, m] = dateStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    dateQuery = Prisma.sql`AND "checkInTime" >= ${start} AND "checkInTime" <= ${end}`;
  } else if (rangeType === "yearly" && dateStr) {
    const y = Number(dateStr);
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    dateQuery = Prisma.sql`AND "checkInTime" >= ${start} AND "checkInTime" <= ${end}`;
  } else {
    return null; // Let the client use default data
  }

  const peakQuery = await prisma.$queryRaw<{ hour: number; total: bigint }[]>`
    SELECT 
      EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar')::int as hour,
      COUNT(*) as total
    FROM visitor_logs
    WHERE 1=1 ${dateQuery} ${regionCondition}
    GROUP BY EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Makassar')
  `;

  const peakSeries = Array.from({ length: 11 }, (_, i) => ({ label: `${String(i + 7).padStart(2, '0')}:00`, value: 0 }));
  for (const row of peakQuery) {
    if (row.hour >= 7 && row.hour <= 17) {
      peakSeries[row.hour - 7].value = Number(row.total);
    }
  }

  return peakSeries;
}
