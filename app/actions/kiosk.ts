"use server"

import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

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

      photoUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
    }

    // 1. BERSIHKAN DATA NOMOR HP
    const cleanPhoneNumber = formData.phoneNumber ? formData.phoneNumber.replace(/\D/g, '') : "";

    // 2. SIMPAN KE DATABASE
    await prisma.visitorLog.create({
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
      }
    });

    // 3. --- NOTIFIKASI TELEGRAM OTOMATIS ---
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      
      // Membuat format Tanggal & Jam khusus WITA (Asia/Makassar)
      const now = new Date();
      const waktuDaftar = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Makassar',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }).format(now);

      // Merakit Pesan Telegram
      const tgMessage = `
🚨 <b>Pelanggan TELKOM</b> 🚨

🗓 <b>Waktu:</b> ${waktuDaftar}

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
        // Kirim dengan Foto
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
        // Kirim Teks Saja (Bila tidak ada foto)
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

    return { success: true };

  } catch (error: any) {
    console.error("Gagal memproses data tamu:", error.message || error);
    return { success: false, error: "Terjadi kesalahan sistem saat menyimpan data." };
  }
}