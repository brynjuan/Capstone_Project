require('dotenv').config();
const { Client } = require('pg');

async function main() {
  console.log("Menghubungkan ke database...");
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    console.log("Mengaktifkan Supabase Realtime untuk tabel visitor_logs...");
    // Create publication if it doesn't exist (Supabase already has supabase_realtime publication)
    // Add table to publication
    await client.query(`
      BEGIN;
      -- Make sure the publication exists
      -- Supabase usually provides 'supabase_realtime' by default.
      ALTER PUBLICATION supabase_realtime ADD TABLE visitor_logs;
      COMMIT;
    `);
    console.log("Berhasil mengaktifkan Realtime!");
  } catch (error) {
    if (error.message.includes('already in publication')) {
      console.log("Realtime sudah aktif sebelumnya.");
    } else {
      console.error("Error:", error.message);
    }
  } finally {
    await client.end();
  }
}

main();
