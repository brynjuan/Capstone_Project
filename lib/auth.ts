import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client"; // <-- Import Enum Role dari Prisma

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 Jam

// 1. Tambahkan role dan region ke dalam Payload
type SessionPayload = {
  adminId: string;
  email: string;
  role: Role;
  region: string | null;
  exp: number;
};

const getSecret = () =>
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-admin-session-secret";

const base64UrlEncode = (value: string) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  createHmac("sha256", getSecret()).update(payload).digest("base64url");

export const createAdminSessionToken = (payload: Omit<SessionPayload, "exp">) => {
  const encodedPayload = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    }),
  );
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyAdminSessionToken = (token: string | undefined) => {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.adminId || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export async function setAdminSession(payload: Omit<SessionPayload, "exp">) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, createAdminSessionToken(payload), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const payload = verifyAdminSessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!payload) return null;

  let admin = null;

  try {
    admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,     // <-- Ambil role dari DB
        region: true,   // <-- Ambil region dari DB
      },
    });
  } catch (error) {
    console.error("Gagal memeriksa sesi admin:", error);
    return null;
  }

  if (!admin || admin.email !== payload.email) return null;

  return admin;
}

export async function requireAdminSession() {
  const admin = await getAdminSession();
  if (!admin) {
    throw new Error("Unauthorized");
  }
  return admin;
}