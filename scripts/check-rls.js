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
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE oid = 'public.visitor_logs'::regclass;
    `);
    console.log(res.rows);
  } finally {
    await client.end();
  }
}
main();
