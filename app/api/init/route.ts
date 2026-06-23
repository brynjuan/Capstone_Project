import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    // 1. Cek apakah sudah ada superadmin agar tidak ganda
    const existingAdmin = await prisma.admin.findFirst();
    if (existingAdmin) {
      return NextResponse.json({ message: "Akun sudah ada di database. Silakan login." });
    }

    // 2. Enkripsi password "admin123"
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // 3. Buat akun SUPERADMIN
    await prisma.admin.create({
      data: {
        name: "Super Administrator",
        email: "super@telkom.co.id",
        password: hashedPassword,
        role: "SUPERADMIN",
      }
    });

    return NextResponse.json({ 
      message: "BERHASIL! Akun Superadmin telah dibuat.",
      email: "supertelkom@gmail.com",
      password: "admin123"
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}