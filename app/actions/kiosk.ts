"use server"

import { prisma } from "@/lib/prisma";
import { VisitStatus } from "@prisma/client"; // <-- PENTING: Import Enum dari Prisma
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// KONFIGURASI CLOUDFLARE R2 (S3 COMPATIBLE)
// ============================================================================
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ============================================================================
// 1. FUNGSI OCR KTP (GOOGLE VISION API)
// ============================================================================
export async function performOCR(photoBase64: string) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    // Membersihkan header base64 jika ada
    const base64Image = photoBase64.replace(/^data:image\/\w+;base64,/, "");

    const requestBody = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    const fullText = result.responses[0]?.fullTextAnnotation?.text || "";

    return { success: true, text: fullText };
  } catch (error) {
    console.error("OCR Error:", error);
    return { success: false, error: "Gagal memproses gambar" };
  }
}

// ============================================================================
// 2. FUNGSI UPLOAD PHOTOBOOTH
// ============================================================================
export async function uploadPhotoboothImage(photoBase64: string) {
  try {
    // 1. Bersihkan header base64
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    // 2. Buat nama file unik untuk photobooth
    const fileName = `photobooth/telkom-${uuidv4().substring(0, 8)}.jpg`;

    // 3. Kirim ke Cloudflare R2
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: imageBuffer,
      ContentType: "image/jpeg",
    }));

    // 4. Rakit URL publiknya (Aman dari kutip ganda)
    const rawDomain = process.env.R2_PUBLIC_DOMAIN || "";
    const baseUrl = rawDomain.replace(/['"]/g, '').replace(/\/+$/, '');

    const publicUrl = `${baseUrl}/${fileName}`;

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error("Gagal upload photobooth:", error);
    return { success: false, error: "Gagal menyimpan foto ke cloud." };
  }
}

// ============================================================================
// 3. FUNGSI SIMPAN RATING PELANGGAN
// ============================================================================
export async function submitVisitorRating(visitorId: string, ratingScore: number) {
  try {
    await prisma.visitorLog.update({
      where: { id: visitorId },
      data: { rating: ratingScore }
    });
    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan rating:", error);
    return { success: false, error: "Gagal menyimpan rating" };
  }
}

// ============================================================================
// 4. FUNGSI SUBMIT DATA TAMU + LOGIKA ANTREAN CERDAS + TELEGRAM
// ============================================================================
export async function submitVisitorData(formData: any, photoBase64: string | null) {
  try {
    let photoUrl = null;
    let imageBuffer: Buffer | null = null; 

    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(base64Data, "base64");
      const fileName = `visitors/${uuidv4()}.jpg`;

      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: imageBuffer,
        ContentType: "image/jpeg",
      }));

      const rawDomain = process.env.R2_PUBLIC_DOMAIN || "https://assets.telkomsulbagteng.my.id";
      const baseUrl = rawDomain.replace(/['"]/g, '').replace(/\/+$/, '');
      photoUrl = `${baseUrl}/${fileName}`;
    }

    // 1. BERSIHKAN DATA NOMOR HP
    const cleanPhoneNumber = formData.phoneNumber ? formData.phoneNumber.replace(/\D/g, '') : "";

    // 2. CEK ANTREAN (SMART QUEUE)
    // Cek apakah ada tamu yang sedang dilayani saat ini
    const activeVisitor = await prisma.visitorLog.findFirst({
      where: { status: VisitStatus.ON_PROGRESS }
    });

    let initialStatus: VisitStatus = VisitStatus.PENDING;
    let startTime = null;

    if (!activeVisitor) {
      // Jika CS sedang kosong, tamu ini langsung dilayani tanpa menunggu!
      initialStatus = VisitStatus.ON_PROGRESS;
      startTime = new Date(); 
    }

    // 3. SIMPAN KE DATABASE
    const newVisitor = await prisma.visitorLog.create({
      data: {
        fullName: `${formData.salutation} ${formData.fullName}`,
        phoneNumber: cleanPhoneNumber, 
        institution: formData.institution,
        internetNumber: formData.internetNumber,
        address: formData.address,
        category: formData.category,
        hostName: formData.hostName || "Nita Wulandari", 
        purpose: formData.purpose || "Kunjungan Umum",
        photoUrl: photoUrl,
        
        // Simpan status antrean & waktu mulai pelayanan
        status: initialStatus,
        serviceStartTime: startTime, 
      }
    });

    // 4. --- NOTIFIKASI TELEGRAM OTOMATIS ---
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      
      const now = new Date();
      const waktuDaftar = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
      }).format(now);

      // Status Antrean untuk pesan Telegram
      const statusAntreanTG = initialStatus === VisitStatus.PENDING 
        ? "⏳ <i>Berada di antrean (Menunggu)</i>" 
        : "✅ <i>Langsung dilayani di meja CS</i>";

      const tgMessage = `
🚨 <b>Pelanggan TELKOM</b> 🚨

🗓 <b>Waktu:</b> ${waktuDaftar}
📊 <b>Status:</b> ${statusAntreanTG}

🏢 <b>Instansi:</b> ${formData.institution}
👤 <b>Nama:</b> ${formData.salutation} ${formData.fullName}
📞 <b>No. HP:</b> ${cleanPhoneNumber}
🌐 <b>No. Internet:</b> ${formData.internetNumber || '-'}

🎯 <b>Kategori:</b> ${formData.category}
👩‍💼 <b>Bertemu:</b> ${formData.hostName || "Nita Wulandari"}
📝 <b>Keperluan:</b> 
<i>${formData.purpose || "-"}</i>
`;

      if (imageBuffer) {
        const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/jpeg" });
        const tgFormData = new FormData();
        tgFormData.append("chat_id", TELEGRAM_CHAT_ID);
        tgFormData.append("photo", blob, "visitor.jpg");
        tgFormData.append("caption", tgMessage);
        tgFormData.append("parse_mode", "HTML");

        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          body: tgFormData,
        }).catch((err) => console.error("Gagal mengirim Telegram:", err));

      } else {
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: tgMessage,
            parse_mode: "HTML"
          }),
        }).catch((err) => console.error("Gagal mengirim Telegram:", err));
      }
    }

    return { success: true, visitorId: newVisitor.id };

  } catch (error: any) {
    console.error("Gagal memproses data tamu:", error.message || error);
    return { success: false, error: "Terjadi kesalahan sistem saat menyimpan data." };
  }
}

export async function getVisitorByPinAction(inputPin: string) {
  try {
    const visitor = await prisma.visitorLog.findUnique({
      where: { pin: inputPin },
      // Pastikan hanya mengambil data yang statusnya masih PENDING atau belum diproses
      // atau buat logika khusus agar PIN hanya bisa dipakai sekali
    });

    if (!visitor) {
      return { success: false, message: "Kode PIN tidak ditemukan atau sudah kadaluwarsa." };
    }

    return { 
      success: true, 
      data: {
        fullName: visitor.fullName,
        institution: visitor.institution,
        phoneNumber: visitor.phoneNumber,
        internetNumber: visitor.internetNumber,
        address: visitor.address,
      }
    };
  } catch (error) {
    console.error("Error fetching visitor by PIN:", error);
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}

// ============================================================================
// 5. FUNGSI ADMIN SELESAIKAN PELAYANAN (ESTAFET OTOMATIS)
// ============================================================================
export async function completeAdminService(visitorId: string, finalStatus: VisitStatus, adminId?: string) {
  try {
    // 1. Akhiri pelayanan tamu saat ini
    await prisma.visitorLog.update({
      where: { id: visitorId },
      data: {
        status: finalStatus,
        checkOutTime: new Date(), 
        adminId: adminId || null  
      }
    });

    // 2. Cari tamu antrean berikutnya (Cari status PENDING yang datang paling awal)
    const nextInQueue = await prisma.visitorLog.findFirst({
      where: { status: VisitStatus.PENDING }, 
      orderBy: { checkInTime: "asc" } 
    });

    // 3. Otomatis "Panggil" ke meja CS
    if (nextInQueue) {
      await prisma.visitorLog.update({
        where: { id: nextInQueue.id },
        data: {
          status: VisitStatus.ON_PROGRESS,
          serviceStartTime: new Date() 
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Gagal update status admin:", error);
    return { success: false, error: "Gagal memproses antrean." };
  }
}