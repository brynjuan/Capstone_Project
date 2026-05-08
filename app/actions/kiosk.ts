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

    if (photoBase64) {
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `visitors/${uuidv4()}.jpg`;

      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: "image/jpeg",
      }));

      photoUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;
    }

    // SIMPAN DATA BARU KE DATABASE
// Di dalam fungsi submitVisitorData:
// Di dalam fungsi submitVisitorData:
await prisma.visitorLog.create({
  data: {
    fullName: `${formData.salutation} ${formData.fullName}`,
    phoneNumber: formData.phoneNumber,
    institution: formData.institution,
    internetNumber: formData.internetNumber, // <-- TAMBAHKAN INI
    address: formData.address,
    category: formData.category,
    hostName: formData.hostName || "Nita Wulandari", 
    purpose: formData.purpose || "Kunjungan Umum",
    photoUrl: photoUrl,
  }
});

    return { success: true };
} catch (error: any) {
    // Hanya menampilkan pesan error intinya saja, bukan seluruh datanya
    console.error("Gagal memproses data tamu:", error.message || error);
    return { success: false, error: "Terjadi kesalahan sistem saat menyimpan data." };
  }
}