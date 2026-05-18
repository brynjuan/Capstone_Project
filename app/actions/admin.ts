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

  await prisma.$transaction(async (tx) => {
    await tx.visitorLog.update({
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
  });

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

export async function createVisitorWithPin(formData: FormData) {
  await requireAdminSession();

  const fullName = String(formData.get("fullName") || "").trim();
  const purpose = String(formData.get("purpose") || "").trim();

  if (!fullName || !purpose) {
    return { success: false, error: "Nama dan Keperluan wajib diisi." };
  }

  try {
    let length = 3; // Mulai dari kombinasi 3 digit (000 - 999)
    let pin = "";

    // LOGIKA ADAPTIF DIGIT PIN
    while (true) {
      const maxCombinations = Math.pow(10, length);
      
      // Menghitung jumlah PIN numerik unik yang panjang karakternya tepat sama dengan nilai 'length' saat ini
      const result = await prisma.$queryRaw<{ count: any }[]>`
        SELECT COUNT(*)::bigint FROM visitor_logs WHERE LENGTH(pin) = ${length}
      `;
      const countOfLength = Number(result[0]?.count || 0);

      // Jika kombinasi digit saat ini belum penuh, buat PIN acak
      if (countOfLength < maxCombinations) {
        while (true) {
          const randomNum = Math.floor(Math.random() * maxCombinations);
          const potentialPin = String(randomNum).padStart(length, '0');
          
          // Cek tabrakan data (Uniqueness check)
          const existing = await prisma.visitorLog.findUnique({
            where: { pin: potentialPin }
          });
          
          if (!existing) {
            pin = potentialPin;
            break;
          }
        }
        break; // Keluar dari loop pencarian panjang digit karena PIN sudah didapatkan
      }
      
      // Jika kombinasi 3 digit habis (1000 data penuh), otomatis loop berlanjut dan panjang digit naik ke 4, dst.
      length++;
    }

    const cleanPhoneNumber = formData.get("phoneNumber") ? String(formData.get("phoneNumber")).replace(/\D/g, '') : null;

    // SISTEM ANTREAN CERDAS (SMART QUEUE) COPIED FROM KIOSK FLOW
    const activeVisitor = await prisma.visitorLog.findFirst({
      where: { status: VisitStatus.ON_PROGRESS }
    });

    let initialStatus: VisitStatus = VisitStatus.PENDING;
    let startTime = null;

    if (!activeVisitor) {
      initialStatus = VisitStatus.ON_PROGRESS;
      startTime = new Date();
    }

    const newVisitor = await prisma.visitorLog.create({
      data: {
        fullName,
        purpose,
        pin,
        phoneNumber: cleanPhoneNumber,
        institution: nullableString(formData.get("institution")),
        internetNumber: nullableString(formData.get("internetNumber")),
        address: nullableString(formData.get("address")),
        category: nullableString(formData.get("category")),
        hostName: nullableString(formData.get("hostName")),
        status: initialStatus,
        serviceStartTime: startTime,
      }
    });

    revalidatePath("/admin");
    return { success: true, pin: newVisitor.pin };
  } catch (error) {
    console.error("Gagal men-generate pengunjung dengan PIN:", error);
    return { success: false, error: "Terjadi kesalahan sistem saat membuat data." };
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