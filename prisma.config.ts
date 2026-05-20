import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Berikan URL direct (Port 5432) ke sini agar CLI dapat mengeksekusi db push tanpa halangan
    url: process.env["DIRECT_URL"],
  },
});