"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearAdminSession, setAdminSession } from "@/lib/auth";

export type LoginState = {
  error?: string;
};

export async function loginAdmin(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  let admin = null;

  try {
    admin = await prisma.admin.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error("Gagal login admin:", error);
    return { error: "Basis data belum dapat diakses. Periksa koneksi internet atau konfigurasi Supabase." };
  }

  if (!admin) {
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);

  if (!isPasswordValid) {
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  await setAdminSession({
    adminId: admin.id,
    email: admin.email,
  });

  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}
