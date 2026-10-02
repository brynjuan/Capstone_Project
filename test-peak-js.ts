import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const visits = await prisma.visitorLog.findMany({
    where: { checkInTime: { gte: startOfDay } },
    select: { status: true }
  });

  const counts: Record<string, number> = {};
  visits.forEach(v => {
    counts[v.status] = (counts[v.status] || 0) + 1;
  });

  console.log('Today is:', startOfDay);
  console.log('Counts:', counts);
  console.log('Total:', visits.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
