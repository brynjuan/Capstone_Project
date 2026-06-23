"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { VisitStatus } from "@prisma/client";

// ============================================================================
// FUNGSI HELPER KEAMANAN & FILTER DAERAH (WAJIB ADA)
// ============================================================================
async function getSessionAndFilter() {
  const session = await requireAdminSession();
  
  // Usir akun KIOSK jika mencoba menjalankan fungsi Admin
  if (session.role === "KIOSK") {
    throw new Error("Akses ditolak. Mesin Kiosk tidak memiliki izin mengakses fungsi Admin.");
  }
  
  const regionFilter = session.role === "SUPERADMIN" ? {} : { region: session.region || "" };
  return { session, regionFilter };
}

const nullableString = (value: FormDataEntryValue | null) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

// ============================================================================
// FUNGSI MANIPULASI DATA (WRITE / UPDATE / DELETE)
// ============================================================================

export async function completeVisit(formData: FormData) {
  const { session } = await getSessionAndFilter();
  const id = String(formData.get("id") || "");

  if (!id) return;

  // 1. Cek keamanan wilayah (Admin daerah lain tidak boleh menyelesaikan data ini)
  const existingVisitor = await prisma.visitorLog.findUnique({ where: { id } });
  if (!existingVisitor) return;
  if (session.role === "ADMIN" && existingVisitor.region !== session.region) {
    throw new Error("Akses ditolak. Ini bukan data wilayah Anda.");
  }

  // 2. Jalankan update status dan tampung data kostumer terbaru
  const updatedVisitor = await prisma.$transaction(async (tx) => {
    const visitor = await tx.visitorLog.update({
      where: { id },
      data: {
        status: VisitStatus.SUCCESS,
        checkOutTime: new Date(),
        adminId: session.id,
      },
    });

    // Panggil antrean berikutnya KHUSUS DI DAERAH YANG SAMA
    const nextVisitor = await tx.visitorLog.findFirst({
      where: { status: VisitStatus.PENDING, region: visitor.region },
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

  // 3. --- NOTIFIKASI TELEGRAM OTOMATIS MENUJU GRUP ATASAN ---
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID_ATASAN = process.env.TELEGRAM_CHAT_ID_ATASAN; 
  
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID_ATASAN) {
    const now = new Date();
    const waktuSelesai = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    }).format(now);

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

    const tgMessage = `
📈 <b>LAPORAN KUNJUNGAN SELESAI (${updatedVisitor.region || "Pusat"})</b> 📈

🗓 <b>Waktu Selesai:</b> ${waktuSelesai}
⏱ <b>Durasi Pelayanan:</b> ${durasiLayanan}
👤 <b>Petugas CS:</b> ${session.name}

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
        const imgFetch = await fetch(updatedVisitor.photoUrl);
        if (imgFetch.ok) {
          const arrayBuffer = await imgFetch.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
          
          const tgFormData = new FormData();
          tgFormData.append("chat_id", TELEGRAM_CHAT_ID_ATASAN);
          tgFormData.append("photo", blob, "visitor.jpg");
          tgFormData.append("caption", tgMessage);
          tgFormData.append("parse_mode", "HTML");

          const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            body: tgFormData,
          });

          if (!res.ok) throw new Error("Gagal upload foto via FormData"); 
        } else {
          throw new Error("Server gagal mengambil foto dari R2");
        }
      } catch (err) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_ATASAN, text: tgMessage, parse_mode: "HTML" })
        });
      }
    } else {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_ATASAN, text: tgMessage, parse_mode: "HTML" })
        });
      } catch (err) {
        console.error("Gagal mengirim pesan teks telegram", err);
      }
    }
  }

  revalidatePath("/admin");
}

export async function reopenVisit(formData: FormData) {
  const { session } = await getSessionAndFilter();
  const id = String(formData.get("id") || "");

  if (!id) return;

  const visitor = await prisma.visitorLog.findUnique({ where: { id } });
  if (!visitor) return;
  if (session.role === "ADMIN" && visitor.region !== session.region) {
    throw new Error("Akses ditolak.");
  }

  const hasActiveVisit = await prisma.visitorLog.count({
    where: { status: VisitStatus.ON_PROGRESS, region: visitor.region }, // Filter area yang sama
  });
  
  const status = hasActiveVisit > 0 ? VisitStatus.PENDING : VisitStatus.ON_PROGRESS;

  await prisma.visitorLog.update({
    where: { id },
    data: {
      status,
      serviceStartTime: status === VisitStatus.ON_PROGRESS ? new Date() : null,
      checkOutTime: null,
      adminId: null,
    },
  });

  revalidatePath("/admin");
}

export async function cancelVisit(formData: FormData) {
  const { session } = await getSessionAndFilter();
  const id = String(formData.get("id") || "");

  if (!id) return;

  const existingVisitor = await prisma.visitorLog.findUnique({ where: { id }});
  if (!existingVisitor || existingVisitor.status === VisitStatus.SUCCESS || existingVisitor.status === VisitStatus.CANCELLED) return;
  
  if (session.role === "ADMIN" && existingVisitor.region !== session.region) {
    throw new Error("Akses ditolak.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.visitorLog.update({
      where: { id },
      data: {
        status: VisitStatus.CANCELLED,
        checkOutTime: new Date(),
        adminId: session.id,
      },
    });

    if (existingVisitor.status === VisitStatus.ON_PROGRESS) {
      const nextVisitor = await tx.visitorLog.findFirst({
        where: { status: VisitStatus.PENDING, region: existingVisitor.region }, // Filter area yang sama
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

export async function generateVisitorPin(formData: FormData) {
  const { session } = await getSessionAndFilter();

  const fullName = String(formData.get("fullName") || "").trim();
  const institution = nullableString(formData.get("institution"));
  const phoneNumber = nullableString(formData.get("phoneNumber"));
  const internetNumber = nullableString(formData.get("internetNumber"));
  const address = nullableString(formData.get("address"));

  if (!fullName) {
    return { success: false, error: "Nama lengkap wajib diisi." };
  }

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
        status: VisitStatus.PRE_REGISTER,
        region: session.region || "Palu", // <-- KUNCI: Sesuaikan dengan region admin pembuat
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
    const { session } = await getSessionAndFilter();
    const regionId = session.region || "global"; // <-- KUNCI: Kiosk status per wilayah

    await prisma.kioskSetting.upsert({
      where: { id: regionId },
      update: { isBusy, message },
      create: { id: regionId, isBusy, message },
    });
    
    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Gagal menyimpan status." };
  }
}

export async function getKioskStatus() {
  try {
    const { session } = await getSessionAndFilter();
    const regionId = session.region || "global"; // <-- KUNCI: Ambil status per wilayah
    
    const setting = await prisma.kioskSetting.findUnique({
      where: { id: regionId },
    });
    return setting || { isBusy: false, message: "" };
  } catch (error) {
    return { isBusy: false, message: "" };
  }
}

export async function clearAllPreRegisterVisitsAction() {
  try {
    const { regionFilter } = await getSessionAndFilter();

    const deletedVisitors = await prisma.visitorLog.deleteMany({
      where: { status: VisitStatus.PRE_REGISTER, ...regionFilter }, // <-- KUNCI: Hapus sesuai filter wilayah
    });

    revalidatePath("/admin");
    return { success: true, count: deletedVisitors.count };
  } catch (error: any) {
    return { success: false, error: "Gagal menghapus data" };
  }
}

export async function updateVisitorInfo(formData: FormData) {
  const { session } = await getSessionAndFilter();

  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const purpose = String(formData.get("purpose") || "").trim();

  if (!id || !fullName || !purpose) return;

  // Lapis keamanan wilayah
  const visitor = await prisma.visitorLog.findUnique({ where: { id }});
  if (!visitor) return;
  if (session.role === "ADMIN" && visitor.region !== session.region) {
    throw new Error("Akses ditolak.");
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