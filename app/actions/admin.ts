"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { notifyRealtime } from "@/lib/realtime";
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
  await notifyRealtime();
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
  await notifyRealtime();
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
  await notifyRealtime();
}

const nullableString = (value: FormDataEntryValue | null) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

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
  await notifyRealtime();
}
