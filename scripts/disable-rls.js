require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE visitor_logs DISABLE ROW LEVEL SECURITY;
    `);
    console.log("Berhasil mematikan RLS di tabel visitor_logs!");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await client.end();
  }
}
main();
