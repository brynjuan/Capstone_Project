"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";

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
        status: "COMPLETED",
        checkOutTime: new Date(),
        adminId: admin.id,
      },
    });

    const nextVisitor = await tx.visitorLog.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    if (nextVisitor) {
      await tx.visitorLog.update({
        where: { id: nextVisitor.id },
        data: {
          status: "ON_PROGRESS",
          checkInTime: new Date(),
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
      status: {
        in: ["ON_PROGRESS", "VISITING"],
      },
    },
  });
  const status = hasActiveVisit > 0 ? "PENDING" : "ON_PROGRESS";

  await prisma.visitorLog.update({
    where: { id },
    data: {
      status,
      checkInTime: status === "ON_PROGRESS" ? new Date() : null,
      checkOutTime: null,
    },
  });

  revalidatePath("/admin");
}
