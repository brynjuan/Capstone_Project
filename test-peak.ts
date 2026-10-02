import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'Asia/Makassar')::int as hour,
      COUNT(*) as total
    FROM visitor_logs
    WHERE "checkInTime" >= '2026-08-01' AND "checkInTime" < '2026-09-01'
    GROUP BY EXTRACT(HOUR FROM "checkInTime" AT TIME ZONE 'Asia/Makassar')
    ORDER BY hour
  `;
  console.log(JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
