import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const [, , emailArg, passwordArg, ...nameParts] = process.argv;

if (!emailArg || !passwordArg) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> [name]");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const password = passwordArg.trim();
const name = nameParts.join(" ").trim() || "Admin Telkom";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum tersedia.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password admin minimal 8 karakter.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

try {
  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
    },
    create: {
      email,
      name,
      password: hashedPassword,
    },
  });

  console.log(`Admin siap digunakan: ${admin.email} (${admin.name})`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
