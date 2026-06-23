// File: app/actions/superadmin.ts
"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { Role } from "@prisma/client";

// 1. Mengambil semua data admin
export async function getAdminListAction() {
  const session = await requireAdminSession();
  if (session.role !== "SUPERADMIN") throw new Error("Akses ditolak. Khusus Superadmin.");
  
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, region: true, createdAt: true }
  });
  return { success: true, data: admins };
}

// 2. Mendaftarkan Admin Baru
export async function createAdminAction(formData: FormData) {
  try {
    const session = await requireAdminSession();
    if (session.role !== "SUPERADMIN") throw new Error("Akses ditolak.");

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as Role;
    const region = formData.get("region") as string;

    // Cek apakah email sudah dipakai
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) return { success: false, error: "Email sudah terdaftar!" };

    // Enkripsi kata sandi
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        region: role === "SUPERADMIN" ? null : region, // Jika Superadmin, abaikan daerah
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membuat admin." };
  }
}

// 3. Menghapus Admin
export async function deleteAdminAction(id: string) {
  try {
    const session = await requireAdminSession();
    if (session.role !== "SUPERADMIN") throw new Error("Akses ditolak.");
    if (session.id === id) return { success: false, error: "Tidak dapat menghapus akun sendiri." };

    await prisma.admin.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Gagal menghapus admin." };
  }
}