const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const db = new PrismaClient({});
  
  console.log("Loading data from data-dump.json...");
  const data = JSON.parse(fs.readFileSync('data-dump.json', 'utf8'));
  const { settings, admins, visitors } = data;
  
  if (settings.length > 0) {
    console.log("Inserting Kiosk Settings...");
    await db.kioskSetting.createMany({ data: settings, skipDuplicates: true });
  }

  if (admins.length > 0) {
    console.log("Inserting Admins...");
    await db.admin.createMany({ data: admins, skipDuplicates: true });
  }

  if (visitors.length > 0) {
    console.log("Inserting Visitor Logs...");
    const chunkSize = 500;
    for (let i = 0; i < visitors.length; i += chunkSize) {
      const chunk = visitors.slice(i, i + chunkSize);
      await db.visitorLog.createMany({ data: chunk, skipDuplicates: true });
      console.log(`Inserted ${Math.min(i + chunk.length, visitors.length)} / ${visitors.length} visitors...`);
    }
  }
  
  console.log("Import complete!");
}

main().catch(console.error).finally(() => process.exit());
