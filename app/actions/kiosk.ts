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
    let fileName = ""; // Pindahkan deklarasi fileName ke sini agar bisa diakses di bawah

    // 1. SIAPKAN URL DAN BUFFER FOTO (TAPI JANGAN DI-UPLOAD DULU)
    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(base64Data, "base64");
      fileName = `visitors/${uuidv4()}.jpg`;

      const rawDomain = process.env.R2_PUBLIC_DOMAIN || "https://assets.telkomsulbagteng.my.id";
      const baseUrl = rawDomain.replace(/['"]/g, '').replace(/\/+$/, '');
      photoUrl = `${baseUrl}/${fileName}`;
    }

    // 2. BERSIHKAN DATA NOMOR HP
    const cleanPhoneNumber = formData.phoneNumber ? formData.phoneNumber.replace(/\D/g, '') : "";

    // 3. CEK ANTREAN (SMART QUEUE)
    const activeVisitor = await prisma.visitorLog.findFirst({
      where: { status: VisitStatus.ON_PROGRESS }
    });

    let initialStatus: VisitStatus = VisitStatus.PENDING;
    let startTime = null;

    if (!activeVisitor) {
      initialStatus = VisitStatus.ON_PROGRESS;
      startTime = new Date(); 
    }

    // 4. SIMPAN KE DATABASE SECARA INSTAN! (Dashboard Admin akan langsung ter-trigger)
    let newVisitor;

    if (formData.pin) {
      newVisitor = await prisma.visitorLog.update({
        where: { pin: formData.pin },
        data: {
          fullName: `${formData.salutation} ${formData.fullName}`,
          phoneNumber: cleanPhoneNumber,
          institution: formData.institution,
          internetNumber: formData.internetNumber,
          address: formData.address,
          category: formData.category,
          hostName: formData.hostName || "Nita Wulandari",
          purpose: formData.purpose || "Kunjungan Umum",
          photoUrl: photoUrl, // URL foto yang digenerate di atas dimasukkan ke sini
          status: initialStatus,
          serviceStartTime: startTime,
          checkInTime: new Date(), 
        }
      });
    } else {
      newVisitor = await prisma.visitorLog.create({
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
          status: initialStatus,
          serviceStartTime: startTime, 
        }
      });
    }

// 5. PROSES UPLOAD R2 & TELEGRAM SECARA PARALEL (Bersamaan)
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Siapkan dua wadah tugas kosong
    let r2Task: Promise<any> = Promise.resolve();
    let telegramTask: Promise<any> = Promise.resolve();

    // TUGAS A: Upload ke Cloudflare R2
    if (imageBuffer && fileName) {
      r2Task = s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: imageBuffer,
        ContentType: "image/jpeg",
      })).then(() => console.log("✅ Upload foto R2 Berhasil"))
         .catch(err => console.error("❌ R2 Error:", err));
    }

    // TUGAS B: Kirim Notifikasi Telegram CS
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const now = new Date();
      const waktuDaftar = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
      }).format(now);

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
        // Kirim file mentah langsung (Tidak perlu tunggu R2 atau Delay!)
        const file = new File([new Uint8Array(imageBuffer)], "visitor.jpg", { type: "image/jpeg" });
        const tgFormData = new FormData();
        tgFormData.append("chat_id", TELEGRAM_CHAT_ID);
        tgFormData.append("photo", file);
        tgFormData.append("caption", tgMessage);
        tgFormData.append("parse_mode", "HTML");

        telegramTask = fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST",
          body: tgFormData,
        }).then(async (res) => {
          if (!res.ok) throw new Error("Gagal kirim foto TG");
          console.log("✅ Pesan Telegram CS (Foto) Berhasil!");
        }).catch(() => {
          // Fallback Teks jika foto gagal
          console.log("🔄 Mengalihkan ke Fallback Teks CS...");
          return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" })
          });
        });
      } else {
        // Teks biasa jika tidak ada foto
        telegramTask = fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" })
        });
      }
    }

    // 👇 KUNCI UTAMA: Paksa Kiosk mengeksekusi kedua tugas BERSAMAAN dan menunggu hingga keduanya selesai 👇
    await Promise.all([r2Task, telegramTask]);

    // 6. HITUNG NOMOR ANTREAN & RESPONSE INSTAN KE KIOSK
    const currentQueueCount = await prisma.visitorLog.count({
      where: {
        status: { in: [VisitStatus.ON_PROGRESS, VisitStatus.PENDING] }
      }
    });

    return { 
      success: true, 
      visitorId: newVisitor.id, 
      queueNumber: currentQueueCount 
    };

  } catch (error: any) {
    console.error("Gagal memproses data tamu:", error.message || error);
    return { success: false, error: "Terjadi kesalahan sistem saat menyimpan data." };
  }
}
export async function getVisitorByPinAction(inputPin: string) {
  try {
    const visitor = await prisma.visitorLog.findUnique({
      where: { pin: inputPin },
    });

    // Validasi: Tolak jika PIN tidak ada atau statusnya BUKAN PRE_REGISTER
    if (!visitor || visitor.status !== VisitStatus.PRE_REGISTER) {
      return { success: false, message: "Kode PIN tidak ditemukan atau sudah digunakan." };
    }

    return { 
      success: true, 
      data: {
        id: visitor.id,
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

export async function confirmMobileArrivalAction(inputPin: string) {
  try {
    const cleanPin = inputPin.trim();
    
    // 1. Cari tamu berdasarkan PIN
    const visitor = await prisma.visitorLog.findUnique({
      where: { pin: cleanPin },
    });

    if (!visitor) {
      return { success: false, message: "Kode PIN tidak ditemukan." };
    }

    // 👇 LOGIKA BENAR: Tamu dari HP harus berstatus PRE_REGISTER, bukan PENDING 👇
    if (visitor.status !== VisitStatus.PRE_REGISTER) {
      return { success: false, message: "Kode PIN ini sudah digunakan atau tiket tidak valid." };
    }

    // 2. CEK ANTREAN (SMART QUEUE)
    // Apakah ada tamu lain yang sedang dilayani CS?
    const activeVisitor = await prisma.visitorLog.findFirst({
      where: { status: VisitStatus.ON_PROGRESS }
    });

    // Jika CS kosong, langsung layani (ON_PROGRESS). Jika CS sibuk, suruh antre (PENDING)
    const newStatus = activeVisitor ? VisitStatus.PENDING : VisitStatus.ON_PROGRESS;
    const startTime = activeVisitor ? null : new Date();

    // 3. GENERATE NOMOR ANTREAN (Angka Murni)
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    // Hitung antrean HANYA dari mereka yang sudah benar-benar datang (Bukan PRE_REGISTER)
    const queueCount = await prisma.visitorLog.count({
      where: { 
        checkInTime: { gte: today },
        status: { not: VisitStatus.PRE_REGISTER } 
      }
    });
    
    const generatedQueueNumber = queueCount + 1; 

    // 4. UPDATE DATABASE: Ubah wujud mereka dari "Gaib" menjadi "Nyata" di Kiosk
    const updatedVisitor = await prisma.visitorLog.update({
      where: { id: visitor.id },
      data: {
        status: newStatus,          // Ubah ke PENDING / ON_PROGRESS
        serviceStartTime: startTime,
        checkInTime: new Date(),    // Argo waktu tunggu baru dimulai SEKARANG
        pin: null,                  // Hanguskan PIN
      }
    });

    // (Opsional) Jika Anda ingin mengirim notifikasi Telegram saat tamu VIP tiba,
    // Anda bisa menambahkan logika fetch ke API Telegram di baris ini.

    return { success: true, data: updatedVisitor, queueNumber: generatedQueueNumber };
  } catch (error: any) {
    console.error("CRASH saat verifikasi PIN Mobile:", error);
    return { success: false, message: "Terjadi kesalahan database." };
  }
}

// app/actions/kiosk.ts
export async function registerMobileVisitorAction(data: any) {
  try {
    // Generate 6 Digit PIN Acak
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();

    const newVisitor = await prisma.visitorLog.create({
      data: {
        fullName: data.fullName,
        institution: data.institution || "Umum",
        phoneNumber: data.phoneNumber,
        internetNumber: data.internetNumber,
        address: data.address,
        category: data.category,
        purpose: data.purpose,
        hostName: data.hostName,
        pin: generatedPin,
        status: VisitStatus.PRE_REGISTER,
        // checkInTime akan di-update nanti saat mereka tiba di Kiosk
      },
    });

    return { success: true, pin: generatedPin, visitorId: newVisitor.id };
  } catch (error) {
    console.error("Gagal prapendaftaran mobile:", error);
    return { success: false, error: "Gagal menyimpan data" };
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