const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const db = new PrismaClient({});
  
  console.log("Fetching old data...");
  const settings = await db.kioskSetting.findMany();
  const admins = await db.admin.findMany();
  const visitors = await db.visitorLog.findMany();
  
  fs.writeFileSync('data-dump.json', JSON.stringify({ settings, admins, visitors }, null, 2));
  console.log(`Saved ${settings.length} settings, ${admins.length} admins, ${visitors.length} visitors to data-dump.json.`);
}

main().catch(console.error).finally(() => process.exit());
