import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;

// Inisialisasi pool koneksi PostgreSQL
const pool = new Pool({ connectionString });
// Masukkan pool ke dalam adapter Prisma
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Passing adapter ke dalam constructor PrismaClient
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ 
    adapter,
    log: ["query"] // Opsional, bisa dihapus jika terminal terlalu penuh
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;