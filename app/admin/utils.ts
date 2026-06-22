// File: app/admin/utils.ts

import { AdminVisitor } from "./types"; // Import tipe data dari file sebelah

export const formatTime = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
};

export const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
};

export const elapsedLabel = (value: string | null) => {
  if (!value) return "-";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}j ${rest}m`;
};

export const durationSeconds = (start: string | null, end?: string | null) => {
  if (!start) return 0;
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((endTime - startTime) / 1000));
};

export const waitSecondsFor = (visitor: AdminVisitor) =>
  durationSeconds(visitor.checkInTime, visitor.serviceStartTime || visitor.checkOutTime);

export const formatDurationClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(rest).padStart(2, "0")}`;
};

export const formatCompactDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}j ${minutes % 60}m`;
};

export const visitorInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "VI";
};

export const visitorCode = (visitor: AdminVisitor, index = 0) => {
  const categoryPrefix = (visitor.category || "Q").replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase() || "Q";
  const numericId = visitor.id.replace(/\D/g, "").slice(-3);
  const number = numericId ? numericId.padStart(3, "0") : String(index + 101).padStart(3, "0");
  return `#${categoryPrefix}-${number}`;
};