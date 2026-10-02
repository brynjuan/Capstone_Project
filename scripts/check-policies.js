require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  try {
    const res = await client.query(`
      SELECT * FROM pg_policies WHERE tablename = 'visitor_logs';
    `);
    console.log("Policies:", res.rows);
  } finally {
    await client.end();
  }
}
main();
