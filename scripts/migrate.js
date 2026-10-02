const { PrismaClient } = require('@prisma/client');

async function main() {
  const oldDb = new PrismaClient({
    datasourceUrl: "postgresql://postgres.niilhydpylmfibtnyppi:K7kqNTVGwNo73Clo@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });

  const newDb = new PrismaClient({
    datasourceUrl: "postgresql://postgres.ukufhpegqirelrglhtrs:Telkomsulbagteng*123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  });

  console.log("Connecting to both databases...");

  console.log("Fetching Kiosk Settings from old DB...");
  const settings = await oldDb.kioskSetting.findMany();
  
  console.log("Fetching Admins from old DB...");
  const admins = await oldDb.admin.findMany();
  
  console.log("Fetching Visitor Logs from old DB...");
  const visitors = await oldDb.visitorLog.findMany();

  console.log(`Found ${settings.length} settings, ${admins.length} admins, ${visitors.length} visitors.`);

  if (settings.length > 0) {
    console.log("Inserting Kiosk Settings...");
    await newDb.kioskSetting.createMany({ data: settings, skipDuplicates: true });
  }

  if (admins.length > 0) {
    console.log("Inserting Admins...");
    await newDb.admin.createMany({ data: admins, skipDuplicates: true });
  }

  if (visitors.length > 0) {
    console.log("Inserting Visitor Logs...");
    const chunkSize = 500;
    for (let i = 0; i < visitors.length; i += chunkSize) {
      const chunk = visitors.slice(i, i + chunkSize);
      await newDb.visitorLog.createMany({ data: chunk, skipDuplicates: true });
      console.log(`Inserted ${Math.min(i + chunk.length, visitors.length)} / ${visitors.length} visitors...`);
    }
  }

  console.log("Migration complete!");
}

main().catch(console.error).finally(() => process.exit());
