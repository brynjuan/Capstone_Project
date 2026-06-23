import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/auth";

export async function GET(request: Request) {
  // 1. Hapus sesi / cookie dari browser
  await clearAdminSession();
  
  // 2. Langsung lempar kembali ke halaman login
  return NextResponse.redirect(new URL("/admin/login", request.url));
}