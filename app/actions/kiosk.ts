"use server"

import { prisma } from "@/lib/prisma";
import { VisitStatus } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { getAdminSession } from "@/lib/auth";

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

// Fungsi verifikasi Kiosk
export async function checkKioskAuthAction() {
  const session = await getAdminSession();
  if (!session || session.role !== "KIOSK") return null;
  return session;
}

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
// 1. FUNGSI OCR KTP (GOOGLE VISION API)
// ============================================================================
export async function performOCR(photoBase64: string) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const base64Image = photoBase64.replace(/^data:image\/\w+;base64,/, "");

    const requestBody = {
      requests: [{ image: { content: base64Image }, features: [{ type: "TEXT_DETECTION" }] }],
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
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    const fileName = `photobooth/telkom-${uuidv4().substring(0, 8)}.jpg`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: imageBuffer,
      ContentType: "image/jpeg",
    }));

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
    // 1. AMBIL REGION DARI KIOSK YANG LOGIN
    const session = await getAdminSession();
    if (!session || !session.region) throw new Error("Kiosk tidak valid atau belum login.");
    const currentRegion = session.region;

    let photoUrl = null;
    let imageBuffer: Buffer | null = null; 
    let fileName = ""; 

    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(base64Data, "base64");
      fileName = `visitors/${uuidv4()}.jpg`;

      const rawDomain = process.env.R2_PUBLIC_DOMAIN || "https://assets.telkomsulbagteng.my.id";
      const baseUrl = rawDomain.replace(/['"]/g, '').replace(/\/+$/, '');
      photoUrl = `${baseUrl}/${fileName}`;
    }

    const cleanPhoneNumber = formData.phoneNumber ? formData.phoneNumber.replace(/\D/g, '') : "";

    // 2. CEK ANTREAN (Hanya untuk region Kiosk ini)
    const activeVisitor = await prisma.visitorLog.findFirst({
      where: { 
        status: VisitStatus.ON_PROGRESS,
        region: currentRegion // <-- FILTER REGION
      }
    });

    let initialStatus: VisitStatus = VisitStatus.PENDING;
    let startTime = null;

    if (!activeVisitor) {
      initialStatus = VisitStatus.ON_PROGRESS;
      startTime = new Date(); 
    }

    // 3. SIMPAN KE DATABASE DENGAN REGION
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
          photoUrl: photoUrl,
          status: initialStatus,
          serviceStartTime: startTime,
          checkInTime: new Date(), 
          region: currentRegion, // <-- SIMPAN REGION
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
          region: currentRegion, // <-- SIMPAN REGION
        }
      });
    }

    // 4. PROSES UPLOAD R2 & TELEGRAM SECARA PARALEL
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
    
    // 👇 PANGGIL FUNGSI PEMILIH GRUP CS SESUAI DAERAH KIOSK 👇
    const TELEGRAM_CHAT_ID = getTelegramChatId(currentRegion, false);

    let r2Task: Promise<any> = Promise.resolve();
    let telegramTask: Promise<any> = Promise.resolve();

    if (imageBuffer && fileName) {
      r2Task = s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: imageBuffer,
        ContentType: "image/jpeg",
      })).then(() => console.log("✅ Upload foto R2 Berhasil"))
         .catch(err => console.error("❌ R2 Error:", err));
    }

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
🚨 <b>Pelanggan TELKOM (${currentRegion})</b> 🚨

🗓 <b>Waktu:</b> ${waktuDaftar}
📊 <b>Status:</b> ${statusAntreanTG}

🏢 <b>Instansi:</b> ${formData.institution}
👤 <b>Nama:</b> ${formData.salutation} ${formData.fullName}
📞 <b>No. HP:</b> ${cleanPhoneNumber}
🌐 <b>No. Internet:</b> ${formData.internetNumber || '-'}
🏠 <b>Alamat:</b> ${formData.address || '-'}

🎯 <b>Kategori:</b> ${formData.category}
👩‍💼 <b>Bertemu:</b> ${formData.hostName || "Nita Wulandari"}
📝 <b>Keperluan:</b> 
<i>${formData.purpose || "-"}</i>
`;

      const processTgResponse = async (res: Response) => {
        if (!res.ok) throw new Error("Gagal kirim TG");
        const data = await res.json();
        if (data.ok && data.result) {
          await prisma.visitorLog.update({
            where: { id: newVisitor.id },
            data: {
              tgMsgId: data.result.message_id.toString(),
              tgChatId: data.result.chat.id.toString(),
            }
          });
        }
      };

      if (imageBuffer) {
        const file = new File([new Uint8Array(imageBuffer)], "visitor.jpg", { type: "image/jpeg" });
        const tgFormData = new FormData();
        tgFormData.append("chat_id", TELEGRAM_CHAT_ID);
        tgFormData.append("photo", file);
        tgFormData.append("caption", tgMessage);
        tgFormData.append("parse_mode", "HTML");

        telegramTask = fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
          method: "POST", body: tgFormData,
        }).then(processTgResponse).catch(() => {
          return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" })
          }).then(processTgResponse);
        });
      } else {
        telegramTask = fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" })
        }).then(processTgResponse);
      }
    }

    await Promise.all([r2Task, telegramTask]);

    // 5. HITUNG NOMOR ANTREAN (Hanya untuk region Kiosk ini)
    const currentQueueCount = await prisma.visitorLog.count({
      where: {
        status: { in: [VisitStatus.ON_PROGRESS, VisitStatus.PENDING] },
        region: currentRegion // <-- PERBAIKAN: Hitung antrean per daerah
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

    if (!visitor || visitor.status !== VisitStatus.PRE_REGISTER) {
      return { success: false, message: "Kode PIN tidak ditemukan atau sudah digunakan." };
    }

    return { 
      success: true, 
      data: {
        id: visitor.id, fullName: visitor.fullName, institution: visitor.institution,
        phoneNumber: visitor.phoneNumber, internetNumber: visitor.internetNumber, address: visitor.address,
      }
    };
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan pada server." };
  }
}

export async function confirmMobileArrivalAction(inputPin: string) {
  try {
    // 1. AMBIL REGION KIOSK YANG MENGKONFIRMASI
    const session = await getAdminSession();
    const currentRegion = session?.region || "Palu";

    const cleanPin = inputPin.trim();
    
    const visitor = await prisma.visitorLog.findUnique({ where: { pin: cleanPin } });
    if (!visitor) return { success: false, message: "Kode PIN tidak ditemukan." };
    if (visitor.status !== VisitStatus.PRE_REGISTER) return { success: false, message: "Kode PIN ini sudah digunakan atau tiket tidak valid." };

    // 2. Cek Antrean Aktif di Region Tersebut
    const activeVisitor = await prisma.visitorLog.findFirst({ 
      where: { status: VisitStatus.ON_PROGRESS, region: currentRegion } // <-- FILTER REGION
    });
    const newStatus = activeVisitor ? VisitStatus.PENDING : VisitStatus.ON_PROGRESS;
    const startTime = activeVisitor ? null : new Date();

    // 3. UPDATE DATABASE (Set status dan update region menjadi region Kiosk tempat dia check-in)
    const updatedVisitor = await prisma.visitorLog.update({
      where: { id: visitor.id },
      data: { 
        status: newStatus, 
        serviceStartTime: startTime, 
        checkInTime: new Date(), 
        pin: null,
        region: currentRegion // <-- PERBAIKAN: Tamu masuk ke daerah Kiosk
      }
    });

    // KIRIM TELEGRAM CS
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    
    // 👇 PANGGIL FUNGSI PEMILIH GRUP CS SESUAI DAERAH KIOSK 👇
    const TELEGRAM_CHAT_ID = getTelegramChatId(currentRegion, false);

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const tgMessage = `🚨 <b>Pelanggan VIP Tiba (via PIN) di ${currentRegion}!</b> 🚨\n\n🏢 <b>Instansi:</b> ${updatedVisitor.institution}\n👤 <b>Nama:</b> ${updatedVisitor.fullName}\n📞 <b>No. HP:</b> ${updatedVisitor.phoneNumber}\n🏠 <b>Alamat:</b> ${updatedVisitor.address || '-'}\n🎯 <b>Keperluan:</b>\n<i>${updatedVisitor.purpose}</i>`;

      const processTgResponse = async (res: Response) => {
        if (!res.ok) throw new Error("Gagal kirim TG");
        const data = await res.json();
        if (data.ok && data.result) {
          await prisma.visitorLog.update({
            where: { id: updatedVisitor.id },
            data: {
              tgMsgId: data.result.message_id.toString(),
              tgChatId: data.result.chat.id.toString(),
            }
          });
        }
      };

      if (updatedVisitor.photoUrl) {
        fetch(updatedVisitor.photoUrl)
          .then(res => res.arrayBuffer())
          .then(buffer => {
            const blob = new Blob([buffer], { type: "image/jpeg" });
            const tgFormData = new FormData();
            tgFormData.append("chat_id", TELEGRAM_CHAT_ID);
            tgFormData.append("photo", blob, "visitor.jpg");
            tgFormData.append("caption", tgMessage);
            tgFormData.append("parse_mode", "HTML");
            fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: tgFormData }).then(processTgResponse);
          })
          .catch(() => {
             fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" }) }).then(processTgResponse);
          });
      } else {
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgMessage, parse_mode: "HTML" }) }).then(processTgResponse);
      }
    }

    // 4. HITUNG NOMOR ANTREAN (Per Daerah)
    const currentQueueCount = await prisma.visitorLog.count({
      where: { 
        status: { in: [VisitStatus.ON_PROGRESS, VisitStatus.PENDING] },
        region: currentRegion // <-- PERBAIKAN: Hitung per daerah
      }
    });

    return { success: true, data: updatedVisitor, queueNumber: currentQueueCount };
  } catch (error: any) {
    return { success: false, message: "Terjadi kesalahan database." };
  }
}

export async function registerMobileVisitorAction(data: any, photoBase64: string | null, turnstileToken?: string) {
  try {
    if (!turnstileToken) {
      return { success: false, error: "Verifikasi CAPTCHA gagal. Silakan coba lagi." };
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (secretKey) {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(turnstileToken)}`,
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return { success: false, error: "Gagal memverifikasi CAPTCHA. Anda terdeteksi sebagai bot." };
      }
    }

    let photoUrl = null;
    if (photoBase64) {
      const uploadResult = await uploadPhotoboothImage(photoBase64); 
      if (uploadResult.success && uploadResult.url) {
        photoUrl = uploadResult.url;
      }
    }

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
        photoUrl: photoUrl,
        region: data.region || "Palu" // <-- PERBAIKAN: Gunakan region yang dipilih user di HP, atau default Palu
      },
    });

    return { success: true, pin: generatedPin, visitorId: newVisitor.id };
  } catch (error) {
    console.error("Gagal prapendaftaran mobile:", error);
    return { success: false, error: "Gagal menyimpan data" };
  }
}

export async function getKioskStatusAction() {
  try {
    const session = await getAdminSession();
    if (!session || !session.region) return { isBusy: false, message: "", region: "Palu" };

    const status = await prisma.kioskSetting.findUnique({ 
      where: { id: session.region } // <-- PERBAIKAN: Cek status Kiosk sesuai daerah
    }); 
    
    if (status) return { isBusy: status.isBusy, message: status.message, region: session.region };
    return { isBusy: false, message: "", region: session.region }; 
  } catch (error) {
    return { isBusy: false, message: "", region: "Palu" };
  }
}

export async function completeAdminService(visitorId: string, finalStatus: VisitStatus, adminId?: string) {
  try {
    // Cari data visitor untuk mengetahui wilayahnya
    const visitor = await prisma.visitorLog.findUnique({ where: { id: visitorId } });
    if (!visitor) throw new Error("Visitor tidak ditemukan");

    await prisma.visitorLog.update({
      where: { id: visitorId },
      data: {
        status: finalStatus,
        checkOutTime: new Date(), 
        adminId: adminId || null  
      }
    });

    // Panggil antrean berikutnya KHUSUS DI REGION YANG SAMA
    const nextInQueue = await prisma.visitorLog.findFirst({
      where: { 
        status: VisitStatus.PENDING,
        region: visitor.region // <-- PERBAIKAN: Estafet antrean sesuai daerah
      }, 
      orderBy: { checkInTime: "asc" } 
    });

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