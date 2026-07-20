"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { VisitStatus } from "@prisma/client";
import { syncToSpreadsheet, deleteFromSpreadsheet } from "@/lib/sheets";
import { uploadPhotoboothImage } from "./kiosk";

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

// 👇 FUNGSI BARU: Pemilih Chat ID Telegram Berdasarkan Daerah 👇
const getTelegramChatId = (region: string | null, isAtasan: boolean = false) => {
  const cleanRegion = (region || "Palu").toUpperCase();
  if (isAtasan) {
    if (cleanRegion === "GORONTALO") return process.env.TELEGRAM_CHAT_ID_ATASAN_GORONTALO || process.env.TELEGRAM_CHAT_ID_ATASAN;
    if (cleanRegion === "PALU") return process.env.TELEGRAM_CHAT_ID_ATASAN_PALU || process.env.TELEGRAM_CHAT_ID_ATASAN;
    return process.env.TELEGRAM_CHAT_ID_ATASAN;
  } else {
    if (cleanRegion === "GORONTALO") return process.env.TELEGRAM_CHAT_ID_GORONTALO || process.env.TELEGRAM_CHAT_ID;
    if (cleanRegion === "PALU") return process.env.TELEGRAM_CHAT_ID_PALU || process.env.TELEGRAM_CHAT_ID;
    return process.env.TELEGRAM_CHAT_ID;
  }
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
  if (existingVisitor.status === VisitStatus.SUCCESS || existingVisitor.status === VisitStatus.CANCELLED) return;
  
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

// 👇 SINKRONISASI KE GOOGLE SPREADSHEET 👇
  try {
    const now = new Date();
    const timestamp = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(now).replace(/\./g, ':');

    await syncToSpreadsheet({
      dbId: updatedVisitor.id,
      timestamp: timestamp,
      namaPelanggan: updatedVisitor.institution || "-",
      namaPic: updatedVisitor.fullName,
      
      // Tambahkan kutip tunggal (') sebelum nomor jika datanya ada
      nomorHpPic: updatedVisitor.phoneNumber ? `'${updatedVisitor.phoneNumber}` : "-",
      nomorUser: updatedVisitor.internetNumber ? `'${updatedVisitor.internetNumber}` : "-",
      
      alamat: updatedVisitor.address || "-",
      kategori: updatedVisitor.category || "-",
      hotda: updatedVisitor.region || "Witel Sulbagteng",
      status: "Selesai",
    });
  } catch (sheetError) {
    console.error("Gagal sinkron ke spreadsheet saat completeVisit:", sheetError);
  }
  // 👆 AKHIR SINKRONISASI 👆
  // 3. --- NOTIFIKASI TELEGRAM OTOMATIS ---
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // Gunakan satu grup besar untuk laporan selesai (baik Palu maupun Gorontalo)
  const TELEGRAM_CHAT_ID_COMPLETED = process.env.TELEGRAM_CHAT_ID_COMPLETED; 
  
  if (TELEGRAM_BOT_TOKEN) {
    const now = new Date();
    const waktuSelesai = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    }).format(now);

    const checkIn = updatedVisitor.checkInTime || now;
    const start = updatedVisitor.serviceStartTime || checkIn;
    const end = updatedVisitor.checkOutTime || now;
    
    const waitSeconds = Math.max(0, Math.floor((new Date(start).getTime() - new Date(checkIn).getTime()) / 1000));
    const durationSeconds = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
    
    const formatDur = (secs: number) => {
      if (secs <= 0) return "0 detik";
      if (secs < 60) return `${secs} detik`;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      if (m < 60) return `${m} menit ${s} detik`;
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h} jam ${rm} menit`;
    };

    const waktuTunggu = formatDur(waitSeconds);
    const durasiLayanan = formatDur(durationSeconds);

    const tgMessage = `
🚨 <b>Pelanggan TELKOM Selesai (${updatedVisitor.region || "Palu"})</b> 🚨

🗓 <b>Waktu Selesai:</b> ${waktuSelesai}
⏳ <b>Waktu Tunggu:</b> ${waktuTunggu}
⏱ <b>Durasi Layanan:</b> ${durasiLayanan}

🏢 <b>Instansi:</b> ${updatedVisitor.institution || '-'}
👤 <b>Nama:</b> ${updatedVisitor.fullName}
📞 <b>No. HP:</b> ${updatedVisitor.phoneNumber || '-'}
🌐 <b>No. Internet:</b> ${updatedVisitor.internetNumber || '-'}
🏠 <b>Alamat:</b> ${updatedVisitor.address || '-'}

🎯 <b>Kategori:</b> ${updatedVisitor.category || '-'}
👩‍💼 <b>Bertemu:</b> ${updatedVisitor.hostName || '-'}
📝 <b>Keperluan:</b>
<i>${updatedVisitor.purpose || "-"}</i>
`;

    // A. EDIT PESAN DI GRUP CS (JIKA ADA)
    if (updatedVisitor.tgMsgId && updatedVisitor.tgChatId) {
      if (updatedVisitor.photoUrl) {
        try {
          const editPayload = {
            chat_id: updatedVisitor.tgChatId,
            message_id: updatedVisitor.tgMsgId,
            media: JSON.stringify({
              type: "photo",
              media: updatedVisitor.photoUrl,
              caption: tgMessage,
              parse_mode: "HTML"
            })
          };
          
          const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageMedia`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(editPayload)
          });
          
          if (!res.ok) throw new Error("Gagal editMessageMedia");
        } catch (err) {
          // Fallback edit text if editing media fails
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: updatedVisitor.tgChatId, message_id: updatedVisitor.tgMsgId, text: tgMessage, parse_mode: "HTML" })
          });
        }
      } else {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: updatedVisitor.tgChatId, message_id: updatedVisitor.tgMsgId, text: tgMessage, parse_mode: "HTML" })
        });
      }
    }

    // B. KIRIM PESAN BARU KE GRUP BESAR (YANG MENGGABUNGKAN SEMUA CABANG)
    if (TELEGRAM_CHAT_ID_COMPLETED) {
      let tgRes;
      if (updatedVisitor.photoUrl) {
        try {
          const imgFetch = await fetch(updatedVisitor.photoUrl);
          if (imgFetch.ok) {
            const arrayBuffer = await imgFetch.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
            
            const tgFormData = new FormData();
            tgFormData.append("chat_id", TELEGRAM_CHAT_ID_COMPLETED);
            tgFormData.append("photo", blob, "visitor.jpg");
            tgFormData.append("caption", tgMessage);
            tgFormData.append("parse_mode", "HTML");

            tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
              method: "POST",
              body: tgFormData,
            });

            if (!tgRes.ok) throw new Error("Gagal upload foto via FormData"); 
          } else {
            throw new Error("Server gagal mengambil foto dari R2");
          }
        } catch (err) {
          tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_COMPLETED, text: tgMessage, parse_mode: "HTML" })
          });
        }
      } else {
        try {
          tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_COMPLETED, text: tgMessage, parse_mode: "HTML" })
          });
        } catch (err) {
          console.error("Gagal mengirim pesan teks telegram", err);
        }
      }

      if (tgRes && tgRes.ok) {
        try {
          const tgData = await tgRes.json();
          if (tgData && tgData.result && tgData.result.message_id) {
            await prisma.visitorLog.update({
              where: { id: updatedVisitor.id },
              data: { tgCompletedMsgId: String(tgData.result.message_id) }
            });
          }
        } catch (err) {
          console.error("Gagal parsing response telegram:", err);
        }
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

  // 👇 Cek apakah ada foto baru yang diunggah 👇
  let photoUrl = visitor.photoUrl;
  const photoBase64 = formData.get("photoBase64") as string | null;
  
  if (photoBase64) {
    const uploadResult = await uploadPhotoboothImage(photoBase64);
    if (uploadResult.success && uploadResult.url) {
      photoUrl = uploadResult.url;
    }
  }

  // 👇 Tangkap hasil pembaruan ke dalam variabel updatedVisitor 👇
  const updatedVisitor = await prisma.visitorLog.update({
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
      photoUrl,
    },
  });

// 👇 SINKRONISASI KE GOOGLE SPREADSHEET 👇
  try {
    // HANYA sinkron ke sheet jika statusnya sudah selesai (SUCCESS)
    // agar tidak membuat baris baru saat data diedit ketika masih diproses.
    if (updatedVisitor.status === VisitStatus.SUCCESS) {
      const now = new Date();
      const timestamp = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(now).replace(/\./g, ':');

      await syncToSpreadsheet({
        dbId: updatedVisitor.id,
        timestamp: timestamp,
        namaPelanggan: updatedVisitor.institution || "-",
        namaPic: updatedVisitor.fullName,
        // Tambahkan kutip tunggal (') sebelum nomor agar formatnya menjadi plain text (rata kiri)
        nomorHpPic: updatedVisitor.phoneNumber ? `'${updatedVisitor.phoneNumber}` : "-",
        nomorUser: updatedVisitor.internetNumber ? `'${updatedVisitor.internetNumber}` : "-",
        alamat: updatedVisitor.address || "-",
        kategori: updatedVisitor.category || "-",
        hotda: updatedVisitor.region || "Witel Sulbagteng",
        status: "Selesai", 
      });
    }
  } catch (sheetError) {
    console.error("Gagal sinkron ke spreadsheet saat edit info:", sheetError);
  }
  // 👆 AKHIR SINKRONISASI 👆

  revalidatePath("/admin");
}

export async function deleteVisitor(formData: FormData) {
  const { session } = await getSessionAndFilter();
  const id = String(formData.get("id") || "");

  if (!id) return;

  const visitor = await prisma.visitorLog.findUnique({ where: { id } });
  if (!visitor) return;

  if (session.role === "ADMIN" && visitor.region !== session.region) {
    throw new Error("Akses ditolak.");
  }

  // 1. Delete from Telegram Completed Group if exists
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID_COMPLETED = process.env.TELEGRAM_CHAT_ID_COMPLETED; 
  
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID_COMPLETED && visitor.tgCompletedMsgId) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID_COMPLETED,
          message_id: visitor.tgCompletedMsgId
        })
      });
    } catch (err) {
      console.error("Gagal menghapus pesan telegram laporan:", err);
    }
  }

  // 2. Delete from Spreadsheet
  try {
    const { deleteFromSpreadsheet } = await import("@/lib/sheets");
    await deleteFromSpreadsheet(id);
  } catch (err) {
    console.error("Gagal memanggil deleteFromSpreadsheet:", err);
  }

  // 3. Delete from DB
  await prisma.visitorLog.delete({ where: { id } });

  revalidatePath("/admin");
}