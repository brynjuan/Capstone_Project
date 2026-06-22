import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Konfigurasi Font
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Konfigurasi Metadata
export const metadata: Metadata = {
  title: "Buku Tamu Digital Telkom",
  description: "Sistem buku tamu digital untuk layanan Telkom.",
};

// Layout Utama (Gabungan)
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Komponen Vercel Speed Insights */}
        <SpeedInsights />
      </body>
    </html>
  );
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Mencegah zoom in saat mengetik di iPhone
  userScalable: false,
};