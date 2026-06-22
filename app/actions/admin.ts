"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { VisitStatus } from "@prisma/client";

export async function completeVisit(formData: FormData) {
  const admin = await requireAdminSession();

  const id = String(formData.get("id") || "");

  if (!id) {
    return;
  }

  // 1. Jalankan update status dan tampung data kostumer terbaru hasil return transaction
  const updatedVisitor = await prisma.$transaction(async (tx) => {
    const visitor = await tx.visitorLog.update({
      where: { id },
      data: {
        status: VisitStatus.SUCCESS,
        checkOutTime: new Date(),
        adminId: admin.id,
      },
    });

    const nextVisitor = await tx.visitorLog.findFirst({
      where: { status: VisitStatus.PENDING },
      orderBy: { checkInTime: "asc" },
    });

    if (nextVisitor) {
      await tx.visitorLog.update({
        where: { id: nextVisitor.id },
        data: {
          status: VisitStatus.ON_PROGRESS,
          serviceStartTime: new Date(),
          checkOutTime: null,
        },
      });
    }

    return visitor;
  });

// 2. --- NOTIFIKASI TELEGRAM OTOMATIS MENUJU GRUP ATASAN ---
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID_ATASAN = process.env.TELEGRAM_CHAT_ID_ATASAN; // Menggunakan grup atasan
  
  console.log("CEK ENV ATASAN - Token:", TELEGRAM_BOT_TOKEN ? "Ada" : "Kosong", "| Chat ID:", TELEGRAM_CHAT_ID_ATASAN);

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID_ATASAN) {
    const now = new Date();
    const waktuSelesai = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    }).format(now);

    // Hitung durasi pelayanan riil dari serviceStartTime hingga checkOutTime
    const start = updatedVisitor.serviceStartTime || updatedVisitor.checkInTime || now;
    const end = updatedVisitor.checkOutTime || now;
    const durationSeconds = Math.max(0, Math.floor((end.getTime() - new Date(start).getTime()) / 1000));
    
    let durasiLayanan = `${durationSeconds} detik`;
    if (durationSeconds >= 60) {
      const minutes = Math.floor(durationSeconds / 60);
      const restSeconds = durationSeconds % 60;
      durasiLayanan = `${minutes} menit ${restSeconds} detik`;
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const restMinutes = minutes % 60;
        durasiLayanan = `${hours} jam ${restMinutes} menit`;
      }
    }

    // Susun format pesan laporan untuk atasan menggunakan data terbaru dari DB
    const tgMessage = `
📈 <b>LAPORAN KUNJUNGAN SELESAI</b> 📈

🗓 <b>Waktu Selesai:</b> ${waktuSelesai}
⏱ <b>Durasi Pelayanan:</b> ${durasiLayanan}
👤 <b>Petugas CS:</b> ${admin.name}

🏢 <b>Instansi:</b> ${updatedVisitor.institution || '-'}
👤 <b>Nama Pelanggan:</b> ${updatedVisitor.fullName}
📞 <b>No. HP:</b> ${updatedVisitor.phoneNumber || '-'}
🌐 <b>No. Internet:</b> ${updatedVisitor.internetNumber || '-'}

🎯 <b>Kategori Kunjungan:</b> ${updatedVisitor.category || '-'}
👩‍💼 <b>Bertemu Dengan:</b> ${updatedVisitor.hostName || '-'}
📝 <b>Keperluan / Detail:</b>
<i>${updatedVisitor.purpose || "-"}</i>
`;

if (updatedVisitor.photoUrl) {
      try {
        // 1. Server lokal Anda mengunduh foto dari Cloudflare terlebih dahulu (Bypass blokir Telegram)
        const imgFetch = await fetch(updatedVisitor.photoUrl);
        
        if (imgFetch.ok) {
          const arrayBuffer = await imgFetch.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
          
          // 2. Kirim foto ke Telegram dalam bentuk File Mentah (Sama seperti metode CS)
          const tgFormData = new FormData();
          tgFormData.append("chat_id", TELEGRAM_CHAT_ID_ATASAN);
          tgFormData.append("photo", blob, "visitor.jpg");
          tgFormData.append("caption", tgMessage);
          tgFormData.append("parse_mode", "HTML");

          const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            body: tgFormData,
          });

          const tgResponse = await res.json();
          
          if (!res.ok) {
             console.error("❌ ERROR TELEGRAM ATASAN (Foto):", JSON.stringify(tgResponse, null, 2));
             throw new Error("Gagal upload foto via FormData"); // Lempar ke blok catch untuk fallback teks
          } else {
             console.log("✅ Pesan Telegram Atasan (Foto) Berhasil!");
          }
        } else {
          throw new Error("Server gagal mengambil foto dari R2");
        }
      } catch (err) {
        console.error("❌ Terjadi kendala foto, mengalihkan ke Fallback Teks:", err);
        // SISTEM FALLBACK: Jika foto benar-benar bermasalah, kirim teks saja agar laporan atasan tidak hilang!
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID_ATASAN,
            text: tgMessage,
            parse_mode: "HTML"
          })
        });
      }

    } else {
      // Jika pelanggan dari awal mendaftar tanpa foto
      try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID_ATASAN,
            text: tgMessage,
            parse_mode: "HTML"
          })
        });
        
        const tgResponse = await res.json();
        
        if (!res.ok) {
           console.error("❌ ERROR TELEGRAM ATASAN (Teks):", JSON.stringify(tgResponse, null, 2));
        } else {
           console.log("✅ Pesan Telegram Atasan (Teks) Berhasil!");
        }
      } catch (err) {
        console.error("❌ Gagal total menghubungi server Telegram Atasan:", err);
      }
    }
  }

  revalidatePath("/admin");
}

export async function reopenVisit(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "");

  if (!id) {
    return;
  }

  const hasActiveVisit = await prisma.visitorLog.count({
    where: {
      status: VisitStatus.ON_PROGRESS,
    },
  });
  const status = hasActiveVisit > 0 ? VisitStatus.PENDING : VisitStatus.ON_PROGRESS;

  await prisma.visitorLog.update({
    where: { id },
    data: {
      status,
      serviceStartTime: status === VisitStatus.ON_PROGRESS ? new Date() : null,
      checkOutTime: null,
    },
  });

  revalidatePath("/admin");
}

export async function cancelVisit(formData: FormData) {
  const admin = await requireAdminSession();

  const id = String(formData.get("id") || "");

  if (!id) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const visitor = await tx.visitorLog.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!visitor || visitor.status === VisitStatus.SUCCESS || visitor.status === VisitStatus.CANCELLED) {
      return;
    }

    await tx.visitorLog.update({
      where: { id },
      data: {
        status: VisitStatus.CANCELLED,
        checkOutTime: new Date(),
        adminId: admin.id,
      },
    });

    if (visitor.status === VisitStatus.ON_PROGRESS) {
      const nextVisitor = await tx.visitorLog.findFirst({
        where: { status: VisitStatus.PENDING },
        orderBy: { checkInTime: "asc" },
      });

      if (nextVisitor) {
        await tx.visitorLog.update({
          where: { id: nextVisitor.id },
          data: {
            status: VisitStatus.ON_PROGRESS,
            serviceStartTime: new Date(),
            checkOutTime: null,
          },
        });
      }
    }
  });

  revalidatePath("/admin");
}

const nullableString = (value: FormDataEntryValue | null) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

// Tambahkan fungsi ini di bagian paling bawah file app/actions/admin.ts

export async function generateVisitorPin(formData: FormData) {
  await requireAdminSession();

  const fullName = String(formData.get("fullName") || "").trim();
  const institution = nullableString(formData.get("institution"));
  const phoneNumber = nullableString(formData.get("phoneNumber"));
  const internetNumber = nullableString(formData.get("internetNumber"));
  const address = nullableString(formData.get("address"));

  if (!fullName) {
    return { success: false, error: "Nama lengkap wajib diisi." };
  }

  // Generate 6 digit PIN angka acak (misal: 482910)
  const pin = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await prisma.visitorLog.create({
      data: {
        fullName,
        institution,
        phoneNumber,
        internetNumber,
        address,
        pin,
        purpose: "Pre-registrasi (Kunjungan Terjadwal)", 
        status: VisitStatus.PRE_REGISTER, // Masuk ke antrean
      },
    });

    revalidatePath("/admin");
    return { success: true, pin };
  } catch (error) {
    console.error("Gagal membuat PIN:", error);
    return { success: false, error: "Terjadi kesalahan saat membuat PIN." };
  }
}

export async function updateKioskStatus(isBusy: boolean, message: string) {
  try {
    await prisma.kioskSetting.upsert({
      where: { id: "global" },
      update: { isBusy, message },
      create: { id: "global", isBusy, message },
    });
    
    // Refresh halaman agar data terbaru langsung tampil
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal mengubah status kiosk:", error);
    return { success: false, error: "Gagal menyimpan status." };
  }
}

export async function getKioskStatus() {
  try {
    const setting = await prisma.kioskSetting.findUnique({
      where: { id: "global" },
    });
    // Mengembalikan string kosong jika belum ada data
    return setting || { isBusy: false, message: "" };
  } catch (error) {
    return { isBusy: false, message: "" };
  }
}

// 4. FITUR BARU: Hapus Semua Antrean PENDING (Sapu Bersih)
export async function clearAllPendingVisitsAction() {
  try {
    await requireAdminSession();

    // Hapus semua data yang statusnya PENDING
    const deletedVisitors = await prisma.visitorLog.deleteMany({
      where: { status: VisitStatus.PENDING },
    });

    revalidatePath("/admin");
    return { success: true, count: deletedVisitors.count };
  } catch (error: any) {
    console.error("Gagal menghapus semua antrean pending:", error);
    return { success: false, error: "Gagal menghapus data" };
  }
}

export async function updateVisitorInfo(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const purpose = String(formData.get("purpose") || "").trim();

  if (!id || !fullName || !purpose) {
    return;
  }

  await prisma.visitorLog.update({
    where: { id },
    data: {
      fullName,
      purpose,
      phoneNumber: nullableString(formData.get("phoneNumber")),
      institution: nullableString(formData.get("institution")),
      internetNumber: nullableString(formData.get("internetNumber")),
      address: nullableString(formData.get("address")),
      category: nullableString(formData.get("category")),
      hostName: nullableString(formData.get("hostName")),
    },

    
  });

  revalidatePath("/admin");
}